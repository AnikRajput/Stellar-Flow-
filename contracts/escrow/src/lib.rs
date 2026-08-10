#![no_std]

mod errors;
mod events;
mod storage;
mod types;

#[cfg(test)]
mod test;

pub use errors::Error;
pub use storage::DataKey;
pub use types::{Milestone, MilestoneStatus, Project, ProjectStatus};

use soroban_sdk::{
    contract, contractclient, contractimpl, panic_with_error, Address, Env, String,
};
use types::Dispute;

#[contract]
pub struct EscrowContract;

#[contractclient(name = "PaymentVaultClient")]
pub trait PaymentVaultContract {
    fn hold_funds(
        env: Env,
        from: Address,
        token: Address,
        amount: i128,
        project_id: u32,
        milestone_id: u32,
    );

    fn release_funds(
        env: Env,
        caller: Address,
        token: Address,
        to: Address,
        amount: i128,
        project_id: u32,
        milestone_id: u32,
    );

    fn refund_funds(
        env: Env,
        caller: Address,
        token: Address,
        to: Address,
        amount: i128,
        project_id: u32,
    );
}

#[contractimpl]
impl EscrowContract {
    pub fn initialize(env: Env, factory: Address, vault: Address) {
        env.storage().persistent().set(&DataKey::Factory, &factory);
        env.storage().persistent().set(&DataKey::Vault, &vault);
        env.storage().persistent().set(&DataKey::ProjectCount, &0u32);
        env.storage().persistent().set(&DataKey::DisputeCount, &0u32);
        env.storage().persistent().set(&DataKey::Paused, &false);
    }

    pub fn create_project(
        env: Env,
        client: Address,
        freelancer: Address,
        token: Address,
        total_amount: i128,
    ) -> u32 {
        require_not_paused(&env);
        client.require_auth();

        if total_amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let project_id = increment_counter(&env, &DataKey::ProjectCount);
        let created_at = env.ledger().timestamp();
        let project = Project {
            id: project_id,
            client,
            freelancer,
            token,
            total_amount,
            escrow_balance: 0,
            status: ProjectStatus::Active,
            milestone_count: 0,
            created_at,
        };

        write_project(&env, &project);
        env.storage()
            .persistent()
            .set(&DataKey::MilestoneAmountSum(project_id), &0i128);
        env.storage()
            .persistent()
            .set(&DataKey::PaidMilestoneCount(project_id), &0u32);

        project_id
    }

    pub fn add_milestone(
        env: Env,
        client: Address,
        project_id: u32,
        name: String,
        amount: i128,
        due_date: u64,
    ) -> u32 {
        require_not_paused(&env);
        client.require_auth();

        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let mut project = read_project(&env, project_id);
        require_project_active(&env, &project);
        require_project_client(&env, &project, &client);

        let current_sum = read_milestone_amount_sum(&env, project_id);
        let next_sum = checked_add(&env, current_sum, amount);
        if next_sum > project.total_amount {
            panic_with_error!(&env, Error::AmountMismatch);
        }

        let milestone_id = project
            .milestone_count
            .checked_add(1)
            .unwrap_or_else(|| panic_with_error!(&env, Error::InvalidState));
        let milestone = Milestone {
            id: milestone_id,
            name,
            amount,
            status: MilestoneStatus::Pending,
            due_date,
        };

        project.milestone_count = milestone_id;
        write_project(&env, &project);
        write_milestone(&env, project_id, &milestone);
        env.storage()
            .persistent()
            .set(&DataKey::MilestoneAmountSum(project_id), &next_sum);

        events::publish_milestone_created(&env, project_id, milestone_id, amount);

        milestone_id
    }

    pub fn deposit(env: Env, client: Address, project_id: u32, amount: i128) {
        require_not_paused(&env);
        client.require_auth();

        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let mut project = read_project(&env, project_id);
        require_project_active(&env, &project);
        require_project_client(&env, &project, &client);

        let next_balance = checked_add(&env, project.escrow_balance, amount);
        if next_balance > project.total_amount {
            panic_with_error!(&env, Error::AmountMismatch);
        }

        let vault_client = payment_vault_client(&env);
        vault_client.hold_funds(&client, &project.token, &amount, &project_id, &0u32);

        project.escrow_balance = next_balance;
        write_project(&env, &project);

        events::publish_funds_deposited(&env, project_id, amount);
    }

    pub fn submit_milestone(env: Env, freelancer: Address, project_id: u32, milestone_id: u32) {
        require_not_paused(&env);
        freelancer.require_auth();

        let project = read_project(&env, project_id);
        require_project_active(&env, &project);
        require_project_freelancer(&env, &project, &freelancer);

        let mut milestone = read_milestone(&env, project_id, milestone_id);
        if milestone.status != MilestoneStatus::Pending {
            panic_with_error!(&env, Error::InvalidState);
        }

        milestone.status = MilestoneStatus::Submitted;
        write_milestone(&env, project_id, &milestone);

        events::publish_milestone_submitted(&env, project_id, milestone_id);
    }

    pub fn approve_milestone(env: Env, client: Address, project_id: u32, milestone_id: u32) {
        require_not_paused(&env);
        client.require_auth();

        let project = read_project(&env, project_id);
        require_project_active(&env, &project);

        if client == project.freelancer {
            panic_with_error!(&env, Error::SelfApprovalNotAllowed);
        }

        require_project_client(&env, &project, &client);

        let mut milestone = read_milestone(&env, project_id, milestone_id);
        if milestone.status != MilestoneStatus::Submitted {
            panic_with_error!(&env, Error::InvalidState);
        }

        milestone.status = MilestoneStatus::Approved;
        write_milestone(&env, project_id, &milestone);

        events::publish_milestone_approved(&env, project_id, milestone_id);
    }

    pub fn release_payment(env: Env, project_id: u32, milestone_id: u32) {
        require_not_paused(&env);

        let mut project = read_project(&env, project_id);
        require_project_active(&env, &project);
        project.client.require_auth();

        let mut milestone = read_milestone(&env, project_id, milestone_id);
        if milestone.status == MilestoneStatus::Paid {
            panic_with_error!(&env, Error::AlreadyPaid);
        }
        if milestone.status != MilestoneStatus::Approved {
            panic_with_error!(&env, Error::InvalidState);
        }
        if project.escrow_balance < milestone.amount {
            panic_with_error!(&env, Error::InvalidState);
        }

        let vault_client = payment_vault_client(&env);
        vault_client.release_funds(
            &env.current_contract_address(),
            &project.token,
            &project.freelancer,
            &milestone.amount,
            &project_id,
            &milestone_id,
        );

        milestone.status = MilestoneStatus::Paid;
        project.escrow_balance = checked_sub(&env, project.escrow_balance, milestone.amount);
        write_milestone(&env, project_id, &milestone);

        let paid_count = increment_paid_milestones(&env, project_id);
        if paid_count == project.milestone_count {
            project.status = ProjectStatus::Completed;
            write_project(&env, &project);
            events::publish_project_completed(&env, project_id);
        } else {
            write_project(&env, &project);
        }
    }

    pub fn open_dispute(
        env: Env,
        initiator: Address,
        project_id: u32,
        milestone_id: u32,
        reason: String,
    ) -> u32 {
        require_not_paused(&env);
        initiator.require_auth();

        let mut project = read_project(&env, project_id);
        require_project_active(&env, &project);
        require_project_participant(&env, &project, &initiator);

        let mut milestone = read_milestone(&env, project_id, milestone_id);
        if milestone.status == MilestoneStatus::Paid || milestone.status == MilestoneStatus::Cancelled
        {
            panic_with_error!(&env, Error::InvalidState);
        }

        let dispute_id = increment_counter(&env, &DataKey::DisputeCount);
        let dispute = Dispute {
            id: dispute_id,
            project_id,
            milestone_id,
            initiator,
            reason: reason.clone(),
            resolved: false,
        };

        project.status = ProjectStatus::Disputed;
        milestone.status = MilestoneStatus::Disputed;

        write_project(&env, &project);
        write_milestone(&env, project_id, &milestone);
        env.storage()
            .persistent()
            .set(&DataKey::Dispute(dispute_id), &dispute);

        events::publish_dispute_opened(&env, dispute_id, project_id, milestone_id);
        events::publish_dispute_reason(&env, dispute_id, &reason);

        dispute_id
    }

    pub fn resolve_dispute(
        env: Env,
        arbitrator: Address,
        dispute_id: u32,
        release_to_freelancer: bool,
    ) {
        require_not_paused(&env);
        arbitrator.require_auth();
        require_factory_admin(&env, &arbitrator);

        let mut dispute = read_dispute(&env, dispute_id);
        if dispute.resolved {
            panic_with_error!(&env, Error::InvalidState);
        }

        let mut project = read_project(&env, dispute.project_id);
        let mut milestone = read_milestone(&env, dispute.project_id, dispute.milestone_id);

        dispute.resolved = true;
        project.status = if release_to_freelancer {
            ProjectStatus::Completed
        } else {
            ProjectStatus::Cancelled
        };
        milestone.status = if release_to_freelancer {
            MilestoneStatus::Paid
        } else {
            MilestoneStatus::Cancelled
        };

        if release_to_freelancer {
            if project.escrow_balance < milestone.amount {
                panic_with_error!(&env, Error::InvalidState);
            }
            project.escrow_balance = checked_sub(&env, project.escrow_balance, milestone.amount);
        }

        env.storage()
            .persistent()
            .set(&DataKey::Dispute(dispute_id), &dispute);
        write_milestone(&env, dispute.project_id, &milestone);
        write_project(&env, &project);

        events::publish_dispute_resolved(&env, dispute_id, release_to_freelancer);
        if release_to_freelancer {
            events::publish_project_completed(&env, dispute.project_id);
        }
    }

    pub fn cancel_project(env: Env, caller: Address, project_id: u32) {
        require_not_paused(&env);
        caller.require_auth();

        let mut project = read_project(&env, project_id);
        require_project_active(&env, &project);
        require_project_client(&env, &project, &caller);

        project.status = ProjectStatus::Cancelled;
        write_project(&env, &project);

        events::publish_project_cancelled(&env, project_id);
    }

    pub fn refund(env: Env, project_id: u32) {
        require_not_paused(&env);

        let mut project = read_project(&env, project_id);
        project.client.require_auth();

        if project.status != ProjectStatus::Cancelled && project.status != ProjectStatus::Disputed {
            panic_with_error!(&env, Error::InvalidState);
        }

        let refunded_amount = project.escrow_balance;
        if refunded_amount > 0 {
            let vault_client = payment_vault_client(&env);
            vault_client.refund_funds(
                &env.current_contract_address(),
                &project.token,
                &project.client,
                &refunded_amount,
                &project_id,
            );
        }

        project.escrow_balance = checked_sub(&env, project.escrow_balance, refunded_amount);
        write_project(&env, &project);

        events::publish_refund_issued(&env, project_id, refunded_amount);
    }

    pub fn pause(env: Env, admin: Address) {
        admin.require_auth();
        require_factory_admin(&env, &admin);

        env.storage().persistent().set(&DataKey::Paused, &true);
    }

    pub fn unpause(env: Env, admin: Address) {
        admin.require_auth();
        require_factory_admin(&env, &admin);

        env.storage().persistent().set(&DataKey::Paused, &false);
    }

    pub fn get_project(env: Env, project_id: u32) -> Project {
        read_project(&env, project_id)
    }

    pub fn get_milestone(env: Env, project_id: u32, milestone_id: u32) -> Milestone {
        read_milestone(&env, project_id, milestone_id)
    }

    pub fn get_project_status(env: Env, project_id: u32) -> ProjectStatus {
        read_project(&env, project_id).status
    }
}

fn write_project(env: &Env, project: &Project) {
    env.storage()
        .persistent()
        .set(&DataKey::Project(project.id), project);
}

fn write_milestone(env: &Env, project_id: u32, milestone: &Milestone) {
    env.storage()
        .persistent()
        .set(&DataKey::Milestone(project_id, milestone.id), milestone);
}

fn read_project(env: &Env, project_id: u32) -> Project {
    env.storage()
        .persistent()
        .get(&DataKey::Project(project_id))
        .unwrap_or_else(|| panic_with_error!(env, Error::ProjectNotFound))
}

fn read_milestone(env: &Env, project_id: u32, milestone_id: u32) -> Milestone {
    env.storage()
        .persistent()
        .get(&DataKey::Milestone(project_id, milestone_id))
        .unwrap_or_else(|| panic_with_error!(env, Error::MilestoneNotFound))
}

fn read_dispute(env: &Env, dispute_id: u32) -> Dispute {
    env.storage()
        .persistent()
        .get(&DataKey::Dispute(dispute_id))
        .unwrap_or_else(|| panic_with_error!(env, Error::InvalidState))
}

fn read_milestone_amount_sum(env: &Env, project_id: u32) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::MilestoneAmountSum(project_id))
        .unwrap_or(0i128)
}

fn increment_paid_milestones(env: &Env, project_id: u32) -> u32 {
    let current = env
        .storage()
        .persistent()
        .get(&DataKey::PaidMilestoneCount(project_id))
        .unwrap_or(0u32);
    let next = current
        .checked_add(1)
        .unwrap_or_else(|| panic_with_error!(env, Error::InvalidState));
    env.storage()
        .persistent()
        .set(&DataKey::PaidMilestoneCount(project_id), &next);
    next
}

fn increment_counter(env: &Env, key: &DataKey) -> u32 {
    let current = env.storage().persistent().get(key).unwrap_or(0u32);
    let next = current
        .checked_add(1)
        .unwrap_or_else(|| panic_with_error!(env, Error::InvalidState));
    env.storage().persistent().set(key, &next);
    next
}

fn payment_vault_client(env: &Env) -> PaymentVaultClient<'_> {
    let vault_address: Address = env
        .storage()
        .persistent()
        .get(&DataKey::Vault)
        .unwrap_or_else(|| panic_with_error!(env, Error::Unauthorized));
    PaymentVaultClient::new(env, &vault_address)
}

fn require_factory_admin(env: &Env, admin: &Address) {
    let stored_factory: Address = env
        .storage()
        .persistent()
        .get(&DataKey::Factory)
        .unwrap_or_else(|| panic_with_error!(env, Error::Unauthorized));
    if stored_factory != *admin {
        panic_with_error!(env, Error::Unauthorized);
    }
}

fn require_not_paused(env: &Env) {
    let paused = env.storage().persistent().get(&DataKey::Paused).unwrap_or(false);
    if paused {
        panic_with_error!(env, Error::ProjectPaused);
    }
}

fn require_project_active(env: &Env, project: &Project) {
    if project.status != ProjectStatus::Active {
        panic_with_error!(env, Error::ProjectNotActive);
    }
}

fn require_project_client(env: &Env, project: &Project, client: &Address) {
    if project.client != *client {
        panic_with_error!(env, Error::Unauthorized);
    }
}

fn require_project_freelancer(env: &Env, project: &Project, freelancer: &Address) {
    if project.freelancer != *freelancer {
        panic_with_error!(env, Error::Unauthorized);
    }
}

fn require_project_participant(env: &Env, project: &Project, participant: &Address) {
    if project.client != *participant && project.freelancer != *participant {
        panic_with_error!(env, Error::Unauthorized);
    }
}

fn checked_add(env: &Env, left: i128, right: i128) -> i128 {
    left.checked_add(right)
        .unwrap_or_else(|| panic_with_error!(env, Error::InvalidAmount))
}

fn checked_sub(env: &Env, left: i128, right: i128) -> i128 {
    left.checked_sub(right)
        .unwrap_or_else(|| panic_with_error!(env, Error::InvalidAmount))
}
