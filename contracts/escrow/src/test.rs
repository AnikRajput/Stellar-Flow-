extern crate std;

use soroban_sdk::{
    testutils::{Address as _, Events as _, MockAuth, MockAuthInvoke},
    vec, Address, Env, IntoVal, String, Symbol,
};

use crate::{
    Error, EscrowContract, EscrowContractClient, Milestone, MilestoneStatus, Project,
    ProjectStatus,
};

fn setup() -> (Env, Address, Address, Address, Address, Address, Address) {
    let env = Env::default();
    let contract_id = env.register(EscrowContract, ());

    let factory = Address::generate(&env);
    let vault = Address::generate(&env);
    let client = Address::generate(&env);
    let freelancer = Address::generate(&env);
    let token = Address::generate(&env);

    let escrow = EscrowContractClient::new(&env, &contract_id);
    escrow.initialize(&factory, &vault);

    (env, contract_id, factory, vault, client, freelancer, token)
}

fn create_project(
    env: &Env,
    contract_id: &Address,
    escrow: &EscrowContractClient<'_>,
    client: &Address,
    freelancer: &Address,
    token: &Address,
    total_amount: i128,
) -> u32 {
    escrow
        .mock_auths(&[MockAuth {
            address: client,
            invoke: &MockAuthInvoke {
                contract: contract_id,
                fn_name: "create_project",
                args: (
                    client.clone(),
                    freelancer.clone(),
                    token.clone(),
                    total_amount,
                )
                    .into_val(env),
                sub_invokes: &[],
            },
        }])
        .create_project(client, freelancer, token, &total_amount)
}

fn add_milestone(
    env: &Env,
    contract_id: &Address,
    escrow: &EscrowContractClient<'_>,
    client: &Address,
    project_id: u32,
    name: &str,
    amount: i128,
    due_date: u64,
) -> u32 {
    escrow
        .mock_auths(&[MockAuth {
            address: client,
            invoke: &MockAuthInvoke {
                contract: contract_id,
                fn_name: "add_milestone",
                args: (
                    client.clone(),
                    project_id,
                    String::from_str(env, name),
                    amount,
                    due_date,
                )
                    .into_val(env),
                sub_invokes: &[],
            },
        }])
        .add_milestone(
            client,
            &project_id,
            &String::from_str(env, name),
            &amount,
            &due_date,
        )
}

fn deposit(
    env: &Env,
    contract_id: &Address,
    escrow: &EscrowContractClient<'_>,
    client: &Address,
    project_id: u32,
    amount: i128,
) {
    escrow
        .mock_auths(&[MockAuth {
            address: client,
            invoke: &MockAuthInvoke {
                contract: contract_id,
                fn_name: "deposit",
                args: (client.clone(), project_id, amount).into_val(env),
                sub_invokes: &[],
            },
        }])
        .deposit(client, &project_id, &amount);
}

fn submit_milestone(
    env: &Env,
    contract_id: &Address,
    escrow: &EscrowContractClient<'_>,
    freelancer: &Address,
    project_id: u32,
    milestone_id: u32,
) {
    escrow
        .mock_auths(&[MockAuth {
            address: freelancer,
            invoke: &MockAuthInvoke {
                contract: contract_id,
                fn_name: "submit_milestone",
                args: (freelancer.clone(), project_id, milestone_id).into_val(env),
                sub_invokes: &[],
            },
        }])
        .submit_milestone(freelancer, &project_id, &milestone_id);
}

#[test]
fn create_project_success() {
    let (env, contract_id, _factory, _vault, client_address, freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &contract_id);

    let project_id = create_project(
        &env,
        &contract_id,
        &escrow,
        &client_address,
        &freelancer,
        &token,
        1_000,
    );

    let project = escrow.get_project(&project_id);
    assert_eq!(project_id, 1);
    assert_eq!(
        project,
        Project {
            id: 1,
            client: client_address,
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
    let (env, contract_id, _factory, _vault, client_address, freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &contract_id);
    let project_id = create_project(
        &env,
        &contract_id,
        &escrow,
        &client_address,
        &freelancer,
        &token,
        1_000,
    );

    let milestone_id =
        add_milestone(&env, &contract_id, &escrow, &client_address, project_id, "Design", 400, 10);

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
    assert_eq!(
        env.events().all(),
        vec![
            &env,
            (
                contract_id,
                (Symbol::new(&env, "MILESTONE_CREATED"), project_id, milestone_id).into_val(&env),
                400i128.into_val(&env),
            ),
        ]
    );
}

#[test]
fn add_milestone_invalid_amount() {
    let (env, contract_id, _factory, _vault, client_address, freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &contract_id);
    let project_id = create_project(
        &env,
        &contract_id,
        &escrow,
        &client_address,
        &freelancer,
        &token,
        1_000,
    );

    let result = escrow
        .mock_auths(&[MockAuth {
            address: &client_address,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "add_milestone",
                args: (
                    client_address.clone(),
                    project_id,
                    String::from_str(&env, "Invalid"),
                    0i128,
                    10u64,
                )
                    .into_val(&env),
                sub_invokes: &[],
            },
        }])
        .try_add_milestone(
            &client_address,
            &project_id,
            &String::from_str(&env, "Invalid"),
            &0i128,
            &10u64,
        );

    assert_eq!(result, Err(Ok(Error::InvalidAmount)));
}

#[test]
fn add_milestone_sum_mismatch() {
    let (env, contract_id, _factory, _vault, client_address, freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &contract_id);
    let project_id = create_project(
        &env,
        &contract_id,
        &escrow,
        &client_address,
        &freelancer,
        &token,
        1_000,
    );

    add_milestone(&env, &contract_id, &escrow, &client_address, project_id, "One", 700, 10);

    let result = escrow
        .mock_auths(&[MockAuth {
            address: &client_address,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "add_milestone",
                args: (
                    client_address.clone(),
                    project_id,
                    String::from_str(&env, "Two"),
                    400i128,
                    20u64,
                )
                    .into_val(&env),
                sub_invokes: &[],
            },
        }])
        .try_add_milestone(
            &client_address,
            &project_id,
            &String::from_str(&env, "Two"),
            &400i128,
            &20u64,
        );

    assert_eq!(result, Err(Ok(Error::AmountMismatch)));
}

#[test]
fn deposit_success() {
    let (env, contract_id, _factory, _vault, client_address, freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &contract_id);
    let project_id = create_project(
        &env,
        &contract_id,
        &escrow,
        &client_address,
        &freelancer,
        &token,
        1_000,
    );

    deposit(&env, &contract_id, &escrow, &client_address, project_id, 600);

    assert_eq!(escrow.get_project(&project_id).escrow_balance, 600);
    assert_eq!(
        env.events().all(),
        vec![
            &env,
            (
                contract_id,
                (Symbol::new(&env, "FUNDS_DEPOSITED"), project_id).into_val(&env),
                600i128.into_val(&env),
            ),
        ]
    );
}

#[test]
fn deposit_zero_rejected() {
    let (env, contract_id, _factory, _vault, client_address, freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &contract_id);
    let project_id = create_project(
        &env,
        &contract_id,
        &escrow,
        &client_address,
        &freelancer,
        &token,
        1_000,
    );

    let result = escrow
        .mock_auths(&[MockAuth {
            address: &client_address,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "deposit",
                args: (client_address.clone(), project_id, 0i128).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .try_deposit(&client_address, &project_id, &0i128);

    assert_eq!(result, Err(Ok(Error::InvalidAmount)));
}

#[test]
fn deposit_overpayment_rejected() {
    let (env, contract_id, _factory, _vault, client_address, freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &contract_id);
    let project_id = create_project(
        &env,
        &contract_id,
        &escrow,
        &client_address,
        &freelancer,
        &token,
        1_000,
    );

    deposit(&env, &contract_id, &escrow, &client_address, project_id, 800);

    let result = escrow
        .mock_auths(&[MockAuth {
            address: &client_address,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "deposit",
                args: (client_address.clone(), project_id, 300i128).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .try_deposit(&client_address, &project_id, &300i128);

    assert_eq!(result, Err(Ok(Error::AmountMismatch)));
}

#[test]
fn submit_milestone_success() {
    let (env, contract_id, _factory, _vault, client_address, freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &contract_id);
    let project_id = create_project(
        &env,
        &contract_id,
        &escrow,
        &client_address,
        &freelancer,
        &token,
        1_000,
    );
    let milestone_id =
        add_milestone(&env, &contract_id, &escrow, &client_address, project_id, "Build", 500, 25);

    submit_milestone(
        &env,
        &contract_id,
        &escrow,
        &freelancer,
        project_id,
        milestone_id,
    );

    assert_eq!(
        escrow.get_milestone(&project_id, &milestone_id).status,
        MilestoneStatus::Submitted
    );
}

#[test]
fn submit_milestone_unauthorized() {
    let (env, contract_id, _factory, _vault, client_address, freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &contract_id);
    let outsider = Address::generate(&env);
    let project_id = create_project(
        &env,
        &contract_id,
        &escrow,
        &client_address,
        &freelancer,
        &token,
        1_000,
    );
    let milestone_id =
        add_milestone(&env, &contract_id, &escrow, &client_address, project_id, "Build", 500, 25);

    let result = escrow
        .mock_auths(&[MockAuth {
            address: &outsider,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "submit_milestone",
                args: (outsider.clone(), project_id, milestone_id).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .try_submit_milestone(&outsider, &project_id, &milestone_id);

    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn approve_milestone_success() {
    let (env, contract_id, _factory, _vault, client_address, freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &contract_id);
    let project_id = create_project(
        &env,
        &contract_id,
        &escrow,
        &client_address,
        &freelancer,
        &token,
        1_000,
    );
    let milestone_id =
        add_milestone(&env, &contract_id, &escrow, &client_address, project_id, "QA", 300, 30);
    submit_milestone(
        &env,
        &contract_id,
        &escrow,
        &freelancer,
        project_id,
        milestone_id,
    );

    escrow
        .mock_auths(&[MockAuth {
            address: &client_address,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "approve_milestone",
                args: (client_address.clone(), project_id, milestone_id).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .approve_milestone(&client_address, &project_id, &milestone_id);

    assert_eq!(
        escrow.get_milestone(&project_id, &milestone_id).status,
        MilestoneStatus::Approved
    );
}

#[test]
fn approve_milestone_by_freelancer_rejected() {
    let (env, contract_id, _factory, _vault, client_address, _freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &contract_id);
    let shared_address = Address::generate(&env);
    let project_id = create_project(
        &env,
        &contract_id,
        &escrow,
        &client_address,
        &shared_address,
        &token,
        1_000,
    );
    let milestone_id =
        add_milestone(&env, &contract_id, &escrow, &client_address, project_id, "QA", 300, 30);
    submit_milestone(
        &env,
        &contract_id,
        &escrow,
        &shared_address,
        project_id,
        milestone_id,
    );

    let result = escrow
        .mock_auths(&[MockAuth {
            address: &shared_address,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "approve_milestone",
                args: (shared_address.clone(), project_id, milestone_id).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .try_approve_milestone(&shared_address, &project_id, &milestone_id);

    assert_eq!(result, Err(Ok(Error::SelfApprovalNotAllowed)));
}

#[test]
fn approve_milestone_unauthorized() {
    let (env, contract_id, _factory, _vault, client_address, freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &contract_id);
    let outsider = Address::generate(&env);
    let project_id = create_project(
        &env,
        &contract_id,
        &escrow,
        &client_address,
        &freelancer,
        &token,
        1_000,
    );
    let milestone_id =
        add_milestone(&env, &contract_id, &escrow, &client_address, project_id, "QA", 300, 30);
    submit_milestone(
        &env,
        &contract_id,
        &escrow,
        &freelancer,
        project_id,
        milestone_id,
    );

    let result = escrow
        .mock_auths(&[MockAuth {
            address: &outsider,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "approve_milestone",
                args: (outsider.clone(), project_id, milestone_id).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .try_approve_milestone(&outsider, &project_id, &milestone_id);

    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn pause_blocks_state_changes() {
    let (env, contract_id, factory, _vault, client_address, freelancer, token) = setup();
    let escrow = EscrowContractClient::new(&env, &contract_id);

    escrow
        .mock_auths(&[MockAuth {
            address: &factory,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "pause",
                args: (factory.clone(),).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .pause(&factory);

    let result = escrow
        .mock_auths(&[MockAuth {
            address: &client_address,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "create_project",
                args: (
                    client_address.clone(),
                    freelancer.clone(),
                    token.clone(),
                    1_000i128,
                )
                    .into_val(&env),
                sub_invokes: &[],
            },
        }])
        .try_create_project(&client_address, &freelancer, &token, &1_000i128);

    assert_eq!(result, Err(Ok(Error::ProjectPaused)));
}
