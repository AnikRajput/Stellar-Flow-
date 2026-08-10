use soroban_sdk::{contracttype, Address, Env, String, Symbol};

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct FundsDepositedEvent {
    pub project_id: u32,
    pub client: Address,
    pub amount: i128,
    pub timestamp: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct MilestoneCreatedEvent {
    pub project_id: u32,
    pub milestone_id: u32,
    pub amount: i128,
    pub timestamp: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct MilestoneSubmittedEvent {
    pub project_id: u32,
    pub milestone_id: u32,
    pub freelancer: Address,
    pub timestamp: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct MilestoneApprovedEvent {
    pub project_id: u32,
    pub milestone_id: u32,
    pub client: Address,
    pub timestamp: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct PaymentReleasedEvent {
    pub project_id: u32,
    pub milestone_id: u32,
    pub freelancer: Address,
    pub amount: i128,
    pub timestamp: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct DisputeOpenedEvent {
    pub project_id: u32,
    pub milestone_id: u32,
    pub initiator: Address,
    pub reason: String,
    pub timestamp: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum DisputeOutcome {
    ReleasedToFreelancer,
    RefundedToClient,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct DisputeResolvedEvent {
    pub project_id: u32,
    pub dispute_id: u32,
    pub outcome: DisputeOutcome,
    pub timestamp: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct ProjectCancelledEvent {
    pub project_id: u32,
    pub caller: Address,
    pub timestamp: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct RefundIssuedEvent {
    pub project_id: u32,
    pub client: Address,
    pub amount: i128,
    pub timestamp: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct ProjectCompletedEvent {
    pub project_id: u32,
    pub timestamp: u64,
}

pub fn publish_funds_deposited(
    env: &Env,
    project_id: u32,
    client: &Address,
    amount: i128,
    timestamp: u64,
) {
    env.events().publish(
        (Symbol::new(env, "FUNDS_DEPOSITED"),),
        FundsDepositedEvent {
            project_id,
            client: client.clone(),
            amount,
            timestamp,
        },
    );
}

pub fn publish_milestone_created(
    env: &Env,
    project_id: u32,
    milestone_id: u32,
    amount: i128,
    timestamp: u64,
) {
    env.events().publish(
        (Symbol::new(env, "MILESTONE_CREATED"),),
        MilestoneCreatedEvent {
            project_id,
            milestone_id,
            amount,
            timestamp,
        },
    );
}

pub fn publish_milestone_submitted(
    env: &Env,
    project_id: u32,
    milestone_id: u32,
    freelancer: &Address,
    timestamp: u64,
) {
    env.events().publish(
        (Symbol::new(env, "MILESTONE_SUBMITTED"),),
        MilestoneSubmittedEvent {
            project_id,
            milestone_id,
            freelancer: freelancer.clone(),
            timestamp,
        },
    );
}

pub fn publish_milestone_approved(
    env: &Env,
    project_id: u32,
    milestone_id: u32,
    client: &Address,
    timestamp: u64,
) {
    env.events().publish(
        (Symbol::new(env, "MILESTONE_APPROVED"),),
        MilestoneApprovedEvent {
            project_id,
            milestone_id,
            client: client.clone(),
            timestamp,
        },
    );
}

pub fn publish_payment_released(
    env: &Env,
    project_id: u32,
    milestone_id: u32,
    freelancer: &Address,
    amount: i128,
    timestamp: u64,
) {
    env.events().publish(
        (Symbol::new(env, "PAYMENT_RELEASED"),),
        PaymentReleasedEvent {
            project_id,
            milestone_id,
            freelancer: freelancer.clone(),
            amount,
            timestamp,
        },
    );
}

pub fn publish_dispute_opened(
    env: &Env,
    project_id: u32,
    milestone_id: u32,
    initiator: &Address,
    reason: &String,
    timestamp: u64,
) {
    env.events().publish(
        (Symbol::new(env, "DISPUTE_OPENED"),),
        DisputeOpenedEvent {
            project_id,
            milestone_id,
            initiator: initiator.clone(),
            reason: reason.clone(),
            timestamp,
        },
    );
}

pub fn publish_dispute_resolved(
    env: &Env,
    project_id: u32,
    dispute_id: u32,
    outcome: DisputeOutcome,
    timestamp: u64,
) {
    env.events().publish(
        (Symbol::new(env, "DISPUTE_RESOLVED"),),
        DisputeResolvedEvent {
            project_id,
            dispute_id,
            outcome,
            timestamp,
        },
    );
}

pub fn publish_project_cancelled(
    env: &Env,
    project_id: u32,
    caller: &Address,
    timestamp: u64,
) {
    env.events().publish(
        (Symbol::new(env, "PROJECT_CANCELLED"),),
        ProjectCancelledEvent {
            project_id,
            caller: caller.clone(),
            timestamp,
        },
    );
}

pub fn publish_refund_issued(
    env: &Env,
    project_id: u32,
    client: &Address,
    amount: i128,
    timestamp: u64,
) {
    env.events().publish(
        (Symbol::new(env, "REFUND_ISSUED"),),
        RefundIssuedEvent {
            project_id,
            client: client.clone(),
            amount,
            timestamp,
        },
    );
}

pub fn publish_project_completed(env: &Env, project_id: u32, timestamp: u64) {
    env.events().publish(
        (Symbol::new(env, "PROJECT_COMPLETED"),),
        ProjectCompletedEvent {
            project_id,
            timestamp,
        },
    );
}
