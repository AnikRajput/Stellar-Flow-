extern crate std;

use soroban_sdk::{
    testutils::{Address as _, Events as _, MockAuth, MockAuthInvoke},
    vec, Address, Env, IntoVal, Symbol,
};

use crate::{
    errors::Error,
    events::{ProjectCreatedEvent, ProjectPausedEvent},
    DataKey,
    Project,
    ProjectFactoryContract,
    ProjectFactoryContractClient,
};

fn setup() -> (
    Env,
    Address,
    Address,
    Address,
    Address,
    Address,
    Address,
) {
    let env = Env::default();
    let contract_id = env.register(ProjectFactoryContract, ());

    let admin = Address::generate(&env);
    let project_client = Address::generate(&env);
    let freelancer = Address::generate(&env);
    let token = Address::generate(&env);
    let replacement_admin = Address::generate(&env);

    let client = ProjectFactoryContractClient::new(&env, &contract_id);
    client.initialize(&admin);

    (
        env,
        contract_id,
        admin,
        project_client,
        freelancer,
        token,
        replacement_admin,
    )
}

#[test]
fn create_project_success() {
    let (env, contract_id, _admin, project_client, freelancer, token, _replacement_admin) = setup();
    let client = ProjectFactoryContractClient::new(&env, &contract_id);

    let project_id = client
        .mock_auths(&[MockAuth {
            address: &project_client,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "create_project",
                args: (
                    project_client.clone(),
                    freelancer.clone(),
                    token.clone(),
                    1_000_i128,
                )
                    .into_val(&env),
                sub_invokes: &[],
            },
        }])
        .create_project(&project_client, &freelancer, &token, &1_000_i128);

    let expected_project = Project {
        project_id: 1,
        client: project_client.clone(),
        freelancer: freelancer.clone(),
        token: token.clone(),
        total_amount: 1_000,
        paused: false,
    };

    assert_eq!(
        env.events().all(),
        vec![
            &env,
            (
                contract_id.clone(),
                (Symbol::new(&env, "PROJECT_CREATED"),).into_val(&env),
                ProjectCreatedEvent {
                    project_id: 1,
                    client: project_client.clone(),
                    freelancer: freelancer.clone(),
                    total_amount: 1_000,
                    timestamp: env.ledger().timestamp(),
                }
                .into_val(&env),
            ),
        ]
    );

    let project = client.get_project(&project_id);

    assert_eq!(project_id, 1);
    assert_eq!(project, expected_project);
    assert_eq!(client.get_project_count(), 1);
}

#[test]
#[should_panic]
fn create_project_unauthorized() {
    let (env, contract_id, _admin, project_client, freelancer, token, _replacement_admin) = setup();
    let client = ProjectFactoryContractClient::new(&env, &contract_id);

    client.create_project(&project_client, &freelancer, &token, &1_000_i128);
}

#[test]
fn create_project_invalid_amount() {
    let (env, contract_id, _admin, project_client, freelancer, token, _replacement_admin) = setup();
    let client = ProjectFactoryContractClient::new(&env, &contract_id);

    let zero_amount = client
        .mock_auths(&[MockAuth {
            address: &project_client,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "create_project",
                args: (
                    project_client.clone(),
                    freelancer.clone(),
                    token.clone(),
                    0_i128,
                )
                    .into_val(&env),
                sub_invokes: &[],
            },
        }])
        .try_create_project(&project_client, &freelancer, &token, &0_i128);

    assert_eq!(zero_amount, Err(Ok(Error::InvalidAmount)));

    let negative_amount = client
        .mock_auths(&[MockAuth {
            address: &project_client,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "create_project",
                args: (
                    project_client.clone(),
                    freelancer.clone(),
                    token.clone(),
                    -50_i128,
                )
                    .into_val(&env),
                sub_invokes: &[],
            },
        }])
        .try_create_project(&project_client, &freelancer, &token, &-50_i128);

    assert_eq!(negative_amount, Err(Ok(Error::InvalidAmount)));
}

#[test]
fn pause_project_by_admin_success() {
    let (env, contract_id, admin, project_client, freelancer, token, _replacement_admin) = setup();
    let client = ProjectFactoryContractClient::new(&env, &contract_id);

    let project_id = client
        .mock_auths(&[MockAuth {
            address: &project_client,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "create_project",
                args: (
                    project_client.clone(),
                    freelancer.clone(),
                    token.clone(),
                    1_000_i128,
                )
                    .into_val(&env),
                sub_invokes: &[],
            },
        }])
        .create_project(&project_client, &freelancer, &token, &1_000_i128);

    client
        .mock_auths(&[MockAuth {
            address: &admin,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "pause_project",
                args: (admin.clone(), project_id).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .pause_project(&admin, &project_id);

    assert_eq!(
        env.events().all(),
        vec![
            &env,
            (
                contract_id.clone(),
                (Symbol::new(&env, "PROJECT_CREATED"),).into_val(&env),
                ProjectCreatedEvent {
                    project_id,
                    client: project_client.clone(),
                    freelancer: freelancer.clone(),
                    total_amount: 1_000,
                    timestamp: env.ledger().timestamp(),
                }
                .into_val(&env),
            ),
            (
                contract_id.clone(),
                (Symbol::new(&env, "PROJECT_PAUSED"),).into_val(&env),
                ProjectPausedEvent {
                    project_id,
                    admin: admin.clone(),
                    timestamp: env.ledger().timestamp(),
                }
                .into_val(&env),
            ),
        ]
    );
    assert!(client.get_project(&project_id).paused);
}

#[test]
fn pause_project_by_non_admin_rejected() {
    let (env, contract_id, _admin, project_client, freelancer, token, _replacement_admin) = setup();
    let client = ProjectFactoryContractClient::new(&env, &contract_id);

    let project_id = client
        .mock_auths(&[MockAuth {
            address: &project_client,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "create_project",
                args: (
                    project_client.clone(),
                    freelancer.clone(),
                    token.clone(),
                    1_000_i128,
                )
                    .into_val(&env),
                sub_invokes: &[],
            },
        }])
        .create_project(&project_client, &freelancer, &token, &1_000_i128);

    let unauthorized_admin = Address::generate(&env);
    let result = client
        .mock_auths(&[MockAuth {
            address: &unauthorized_admin,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "pause_project",
                args: (unauthorized_admin.clone(), project_id).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .try_pause_project(&unauthorized_admin, &project_id);

    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn transfer_admin_success() {
    let (env, contract_id, admin, _project_client, _freelancer, _token, replacement_admin) = setup();
    let client = ProjectFactoryContractClient::new(&env, &contract_id);

    client
        .mock_auths(&[MockAuth {
            address: &admin,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "transfer_admin",
                args: (admin.clone(), replacement_admin.clone()).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .transfer_admin(&admin, &replacement_admin);

    let stored_admin: Address = env
        .storage()
        .persistent()
        .get(&DataKey::Admin)
        .unwrap();
    assert_eq!(stored_admin, replacement_admin);
}
