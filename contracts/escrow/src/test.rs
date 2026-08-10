extern crate std;

use soroban_sdk::{
    contract, contractimpl, contracttype,
    testutils::{Address as _, Events as _},
    token::{self, StellarAssetClient},
    vec, Address, Env, IntoVal, String, Symbol,
};

use crate::{
    events::{
        DisputeOpenedEvent, DisputeOutcome, DisputeResolvedEvent, FundsDepositedEvent,
        MilestoneApprovedEvent, PaymentReleasedEvent, ProjectCancelledEvent,
    },
    Error, EscrowContract, EscrowContractClient, Milestone, MilestoneStatus, Project,
    ProjectStatus,
};

#[derive(Clone)]
#[contracttype]
enum TestVaultKey {
    Escrow,
    Balance(u32),
}

#[contract]
struct TestPaymentVault;

#[contractimpl]
impl TestPaymentVault {
    pub fn initialize(env: Env, escrow: Address) {
        env.storage()
            .persistent()
            .set(&TestVaultKey::Escrow, &escrow);
    }

    pub fn hold_funds(
        env: Env,
        from: Address,
        token: Address,
        amount: i128,
        project_id: u32,
        _milestone_id: u32,
    ) {
        token::Client::new(&env, &token).transfer(
            &from,
            &env.current_contract_address(),
            &amount,
        );
        let next = read_vault_balance(&env, project_id) + amount;
        env.storage()
            .persistent()
            .set(&TestVaultKey::Balance(project_id), &next);
    }

    pub fn release_funds(
        env: Env,
        caller: Address,
        token: Address,
        to: Address,
        amount: i128,
        project_id: u32,
        _milestone_id: u32,
    ) {
        let escrow: Address = env
            .storage()
            .persistent()
            .get(&TestVaultKey::Escrow)
            .unwrap();
        if caller != escrow {
            panic!("unauthorized");
        }

        token::Client::new(&env, &token).transfer(
            &env.current_contract_address(),
            &to,
            &amount,
        );
        let next = read_vault_balance(&env, project_id) - amount;
        env.storage()
            .persistent()
            .set(&TestVaultKey::Balance(project_id), &next);
    }

    pub fn refund_funds(
        env: Env,
        caller: Address,
        token: Address,
        to: Address,
        amount: i128,
        project_id: u32,
    ) {
        let escrow: Address = env
            .storage()
            .persistent()
            .get(&TestVaultKey::Escrow)
            .unwrap();
        if caller != escrow {
            panic!("unauthorized");
        }

        token::Client::new(&env, &token).transfer(
            &env.current_contract_address(),
            &to,
            &amount,
        );
        let next = read_vault_balance(&env, project_id) - amount;
        env.storage()
            .persistent()
            .set(&TestVaultKey::Balance(project_id), &next);
    }

    pub fn get_vault_balance(env: Env, project_id: u32) -> i128 {
        read_vault_balance(&env, project_id)
    }
}

fn read_vault_balance(env: &Env, project_id: u32) -> i128 {
    env.storage()
        .persistent()
        .get(&TestVaultKey::Balance(project_id))
        .unwrap_or(0i128)
}

fn setup() -> (Env, Address, Address, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let escrow_id = env.register(EscrowContract, ());
    let vault_id = env.register(TestPaymentVault, ());
    let factory = Address::generate(&env);
    let client = Address::generate(&env);
    let freelancer = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_address = token.address();
    StellarAssetClient::new(&env, &token_address).mint(&client, &10_000i128);

    let vault = TestPaymentVaultClient::new(&env, &vault_id);
    vault.initialize(&escrow_id);

    let escrow = EscrowContractClient::new(&env, &escrow_id);
    escrow.initialize(&factory, &vault_id);

    (
        env,
        escrow_id,
        vault_id,
        factory,
        client,
        freelancer,
        token_address,
    )
}

fn create_project(
    escrow: &EscrowContractClient<'_>,
    client: &Address,
    freelancer: &Address,
    token: &Address,
    total_amount: i128,
) -> u32 {
    escrow.create_project(client, freelancer, token, &total_amount)
}

fn add_milestone(
    env: &Env,
    escrow: &EscrowContractClient<'_>,
    client: &Address,
    project_id: u32,
    name: &str,
    amount: i128,
    due_date: u64,
) -> u32 {
    escrow.add_milestone(
        client,
        &project_id,
        &String::from_str(env, name),
        &amount,
        &due_date,
    )
}

fn funded_project(
    env: &Env,
    escrow: &EscrowContractClient<'_>,
    client: &Address,
    freelancer: &Address,
    token: &Address,
) -> (u32, u32) {
    let project_id = create_project(escrow, client, freelancer, token, 1_000);
    let milestone_id = add_milestone(env, escrow, client, project_id, "Phase 1", 500, 10);
    escrow.deposit(client, &project_id, &500i128);
    (project_id, milestone_id)
}

#[test]
fn create_project_success() {
    let (env, escrow_id, _vault_id, _factory, client, freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &escrow_id);

    let project_id = create_project(&escrow, &client, &freelancer, &token, 1_000);

    assert_eq!(project_id, 1);
    assert_eq!(
        escrow.get_project(&project_id),
        Project {
            id: 1,
            client,
            freelancer,
            token,
            total_amount: 1_000,
            escrow_balance: 0,
            status: ProjectStatus::Active,
            milestone_count: 0,
            created_at: env.ledger().timestamp(),
        }
    );
}

#[test]
fn add_milestone_success() {
    let (env, escrow_id, _vault_id, _factory, client, freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &escrow_id);
    let project_id = create_project(&escrow, &client, &freelancer, &token, 1_000);

    let milestone_id = add_milestone(&env, &escrow, &client, project_id, "Design", 400, 10);

    assert_eq!(milestone_id, 1);
    assert_eq!(
        escrow.get_milestone(&project_id, &milestone_id),
        Milestone {
            id: 1,
            name: String::from_str(&env, "Design"),
            amount: 400,
            status: MilestoneStatus::Pending,
            due_date: 10,
        }
    );
}

#[test]
fn add_milestone_invalid_amount() {
    let (env, escrow_id, _vault_id, _factory, client, freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &escrow_id);
    let project_id = create_project(&escrow, &client, &freelancer, &token, 1_000);

    let result = escrow.try_add_milestone(
        &client,
        &project_id,
        &String::from_str(&env, "Invalid"),
        &0i128,
        &10u64,
    );

    assert_eq!(result, Err(Ok(Error::InvalidAmount)));
}

#[test]
fn add_milestone_sum_mismatch() {
    let (env, escrow_id, _vault_id, _factory, client, freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &escrow_id);
    let project_id = create_project(&escrow, &client, &freelancer, &token, 1_000);

    add_milestone(&env, &escrow, &client, project_id, "One", 700, 10);

    let result = escrow.try_add_milestone(
        &client,
        &project_id,
        &String::from_str(&env, "Two"),
        &400i128,
        &20u64,
    );

    assert_eq!(result, Err(Ok(Error::AmountMismatch)));
}

#[test]
fn deposit_success() {
    let (env, escrow_id, vault_id, _factory, client, freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &escrow_id);
    let vault = TestPaymentVaultClient::new(&env, &vault_id);
    let project_id = create_project(&escrow, &client, &freelancer, &token, 1_000);

    escrow.deposit(&client, &project_id, &600i128);

    assert_eq!(escrow.get_project(&project_id).escrow_balance, 600);
    assert_eq!(vault.get_vault_balance(&project_id), 600);
    assert_eq!(
        env.events().all(),
        vec![
            &env,
            (
                escrow_id.clone(),
                (Symbol::new(&env, "FUNDS_DEPOSITED"),).into_val(&env),
                FundsDepositedEvent {
                    project_id,
                    client: client.clone(),
                    amount: 600,
                    timestamp: env.ledger().timestamp(),
                }
                .into_val(&env),
            ),
        ]
    );
}

#[test]
fn deposit_zero_rejected() {
    let (env, escrow_id, _vault_id, _factory, client, freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &escrow_id);
    let project_id = create_project(&escrow, &client, &freelancer, &token, 1_000);

    let result = escrow.try_deposit(&client, &project_id, &0i128);

    assert_eq!(result, Err(Ok(Error::InvalidAmount)));
}

#[test]
fn deposit_overpayment_rejected() {
    let (env, escrow_id, _vault_id, _factory, client, freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &escrow_id);
    let project_id = create_project(&escrow, &client, &freelancer, &token, 1_000);

    escrow.deposit(&client, &project_id, &800i128);
    let result = escrow.try_deposit(&client, &project_id, &300i128);

    assert_eq!(result, Err(Ok(Error::AmountMismatch)));
}

#[test]
fn submit_milestone_success() {
    let (env, escrow_id, _vault_id, _factory, client, freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &escrow_id);
    let project_id = create_project(&escrow, &client, &freelancer, &token, 1_000);
    let milestone_id = add_milestone(&env, &escrow, &client, project_id, "Build", 500, 25);

    escrow.submit_milestone(&freelancer, &project_id, &milestone_id);

    assert_eq!(
        escrow.get_milestone(&project_id, &milestone_id).status,
        MilestoneStatus::Submitted
    );
}

#[test]
fn submit_milestone_unauthorized() {
    let (env, escrow_id, _vault_id, _factory, client, freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &escrow_id);
    let outsider = Address::generate(&env);
    let project_id = create_project(&escrow, &client, &freelancer, &token, 1_000);
    let milestone_id = add_milestone(&env, &escrow, &client, project_id, "Build", 500, 25);

    let result = escrow.try_submit_milestone(&outsider, &project_id, &milestone_id);

    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn approve_milestone_success() {
    let (env, escrow_id, _vault_id, _factory, client, freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &escrow_id);
    let project_id = create_project(&escrow, &client, &freelancer, &token, 1_000);
    let milestone_id = add_milestone(&env, &escrow, &client, project_id, "QA", 300, 30);
    escrow.submit_milestone(&freelancer, &project_id, &milestone_id);

    escrow.approve_milestone(&client, &project_id, &milestone_id);

    assert_eq!(
        escrow.get_milestone(&project_id, &milestone_id).status,
        MilestoneStatus::Approved
    );
    assert_eq!(
        env.events().all(),
        vec![
            &env,
            (
                escrow_id.clone(),
                (Symbol::new(&env, "MILESTONE_CREATED"),).into_val(&env),
                crate::events::MilestoneCreatedEvent {
                    project_id,
                    milestone_id,
                    amount: 300,
                    timestamp: env.ledger().timestamp(),
                }
                .into_val(&env),
            ),
            (
                escrow_id.clone(),
                (Symbol::new(&env, "MILESTONE_SUBMITTED"),).into_val(&env),
                crate::events::MilestoneSubmittedEvent {
                    project_id,
                    milestone_id,
                    freelancer: freelancer.clone(),
                    timestamp: env.ledger().timestamp(),
                }
                .into_val(&env),
            ),
            (
                escrow_id.clone(),
                (Symbol::new(&env, "MILESTONE_APPROVED"),).into_val(&env),
                MilestoneApprovedEvent {
                    project_id,
                    milestone_id,
                    client: client.clone(),
                    timestamp: env.ledger().timestamp(),
                }
                .into_val(&env),
            ),
        ]
    );
}

#[test]
fn approve_milestone_by_freelancer_rejected() {
    let (env, escrow_id, _vault_id, _factory, client, _freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &escrow_id);
    let shared_address = Address::generate(&env);
    let project_id = create_project(&escrow, &client, &shared_address, &token, 1_000);
    let milestone_id = add_milestone(&env, &escrow, &client, project_id, "QA", 300, 30);
    escrow.submit_milestone(&shared_address, &project_id, &milestone_id);

    let result = escrow.try_approve_milestone(&shared_address, &project_id, &milestone_id);

    assert_eq!(result, Err(Ok(Error::SelfApprovalNotAllowed)));
}

#[test]
fn approve_milestone_unauthorized() {
    let (env, escrow_id, _vault_id, _factory, client, freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &escrow_id);
    let outsider = Address::generate(&env);
    let project_id = create_project(&escrow, &client, &freelancer, &token, 1_000);
    let milestone_id = add_milestone(&env, &escrow, &client, project_id, "QA", 300, 30);
    escrow.submit_milestone(&freelancer, &project_id, &milestone_id);

    let result = escrow.try_approve_milestone(&outsider, &project_id, &milestone_id);

    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn pause_blocks_state_changes() {
    let (env, escrow_id, _vault_id, factory, client, freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &escrow_id);

    escrow.pause(&factory);

    let result = escrow.try_create_project(&client, &freelancer, &token, &1_000i128);

    assert_eq!(result, Err(Ok(Error::ProjectPaused)));
}

#[test]
fn release_payment_success_via_vault_cross_contract_call() {
    let (env, escrow_id, vault_id, _factory, client, freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &escrow_id);
    let vault = TestPaymentVaultClient::new(&env, &vault_id);
    let token_client = token::Client::new(&env, &token);
    let (project_id, milestone_id) = funded_project(&env, &escrow, &client, &freelancer, &token);

    escrow.submit_milestone(&freelancer, &project_id, &milestone_id);
    escrow.approve_milestone(&client, &project_id, &milestone_id);
    escrow.release_payment(&project_id, &milestone_id);

    assert_eq!(
        escrow.get_milestone(&project_id, &milestone_id).status,
        MilestoneStatus::Paid
    );
    assert_eq!(escrow.get_project(&project_id).escrow_balance, 0);
    assert_eq!(vault.get_vault_balance(&project_id), 0);
    assert_eq!(token_client.balance(&freelancer), 500);
    assert_eq!(
        env.events().all(),
        vec![
            &env,
            (
                escrow_id.clone(),
                (Symbol::new(&env, "MILESTONE_CREATED"),).into_val(&env),
                crate::events::MilestoneCreatedEvent {
                    project_id,
                    milestone_id,
                    amount: 500,
                    timestamp: env.ledger().timestamp(),
                }
                .into_val(&env),
            ),
            (
                escrow_id.clone(),
                (Symbol::new(&env, "FUNDS_DEPOSITED"),).into_val(&env),
                FundsDepositedEvent {
                    project_id,
                    client: client.clone(),
                    amount: 500,
                    timestamp: env.ledger().timestamp(),
                }
                .into_val(&env),
            ),
            (
                escrow_id.clone(),
                (Symbol::new(&env, "MILESTONE_SUBMITTED"),).into_val(&env),
                crate::events::MilestoneSubmittedEvent {
                    project_id,
                    milestone_id,
                    freelancer: freelancer.clone(),
                    timestamp: env.ledger().timestamp(),
                }
                .into_val(&env),
            ),
            (
                escrow_id.clone(),
                (Symbol::new(&env, "MILESTONE_APPROVED"),).into_val(&env),
                MilestoneApprovedEvent {
                    project_id,
                    milestone_id,
                    client: client.clone(),
                    timestamp: env.ledger().timestamp(),
                }
                .into_val(&env),
            ),
            (
                escrow_id.clone(),
                (Symbol::new(&env, "PAYMENT_RELEASED"),).into_val(&env),
                PaymentReleasedEvent {
                    project_id,
                    milestone_id,
                    freelancer: freelancer.clone(),
                    amount: 500,
                    timestamp: env.ledger().timestamp(),
                }
                .into_val(&env),
            ),
            (
                escrow_id.clone(),
                (Symbol::new(&env, "PROJECT_COMPLETED"),).into_val(&env),
                crate::events::ProjectCompletedEvent {
                    project_id,
                    timestamp: env.ledger().timestamp(),
                }
                .into_val(&env),
            ),
        ]
    );
}

#[test]
fn release_payment_double_rejected() {
    let (env, escrow_id, _vault_id, _factory, client, freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &escrow_id);
    let (project_id, milestone_id) = funded_project(&env, &escrow, &client, &freelancer, &token);

    escrow.submit_milestone(&freelancer, &project_id, &milestone_id);
    escrow.approve_milestone(&client, &project_id, &milestone_id);
    escrow.release_payment(&project_id, &milestone_id);

    let result = escrow.try_release_payment(&project_id, &milestone_id);

    assert_eq!(result, Err(Ok(Error::AlreadyPaid)));
}

#[test]
fn open_dispute_emits_event() {
    let (env, escrow_id, _vault_id, _factory, client, freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &escrow_id);
    let project_id = create_project(&escrow, &client, &freelancer, &token, 1_000);
    let milestone_id = add_milestone(&env, &escrow, &client, project_id, "Dispute", 400, 20);
    let reason = String::from_str(&env, "Scope mismatch");

    let dispute_id = escrow.open_dispute(&freelancer, &project_id, &milestone_id, &reason);

    assert_eq!(dispute_id, 1);
    assert_eq!(
        env.events().all(),
        vec![
            &env,
            (
                escrow_id.clone(),
                (Symbol::new(&env, "MILESTONE_CREATED"),).into_val(&env),
                crate::events::MilestoneCreatedEvent {
                    project_id,
                    milestone_id,
                    amount: 400,
                    timestamp: env.ledger().timestamp(),
                }
                .into_val(&env),
            ),
            (
                escrow_id.clone(),
                (Symbol::new(&env, "DISPUTE_OPENED"),).into_val(&env),
                DisputeOpenedEvent {
                    project_id,
                    milestone_id,
                    initiator: freelancer.clone(),
                    reason,
                    timestamp: env.ledger().timestamp(),
                }
                .into_val(&env),
            ),
        ]
    );
}

#[test]
fn resolve_dispute_emits_event() {
    let (env, escrow_id, _vault_id, factory, client, freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &escrow_id);
    let project_id = create_project(&escrow, &client, &freelancer, &token, 1_000);
    let milestone_id = add_milestone(&env, &escrow, &client, project_id, "Dispute", 400, 20);
    let dispute_id = escrow.open_dispute(
        &freelancer,
        &project_id,
        &milestone_id,
        &String::from_str(&env, "Scope mismatch"),
    );

    escrow.resolve_dispute(&factory, &dispute_id, &false);

    assert_eq!(
        env.events().all(),
        vec![
            &env,
            (
                escrow_id.clone(),
                (Symbol::new(&env, "MILESTONE_CREATED"),).into_val(&env),
                crate::events::MilestoneCreatedEvent {
                    project_id,
                    milestone_id,
                    amount: 400,
                    timestamp: env.ledger().timestamp(),
                }
                .into_val(&env),
            ),
            (
                escrow_id.clone(),
                (Symbol::new(&env, "DISPUTE_OPENED"),).into_val(&env),
                DisputeOpenedEvent {
                    project_id,
                    milestone_id,
                    initiator: freelancer.clone(),
                    reason: String::from_str(&env, "Scope mismatch"),
                    timestamp: env.ledger().timestamp(),
                }
                .into_val(&env),
            ),
            (
                escrow_id.clone(),
                (Symbol::new(&env, "DISPUTE_RESOLVED"),).into_val(&env),
                DisputeResolvedEvent {
                    project_id,
                    dispute_id,
                    outcome: DisputeOutcome::RefundedToClient,
                    timestamp: env.ledger().timestamp(),
                }
                .into_val(&env),
            ),
        ]
    );
}

#[test]
fn cancel_project_emits_event() {
    let (env, escrow_id, _vault_id, _factory, client, freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &escrow_id);
    let project_id = create_project(&escrow, &client, &freelancer, &token, 1_000);

    escrow.cancel_project(&client, &project_id);

    assert_eq!(
        env.events().all(),
        vec![
            &env,
            (
                escrow_id,
                (Symbol::new(&env, "PROJECT_CANCELLED"),).into_val(&env),
                ProjectCancelledEvent {
                    project_id,
                    caller: client,
                    timestamp: env.ledger().timestamp(),
                }
                .into_val(&env),
            ),
        ]
    );
}
