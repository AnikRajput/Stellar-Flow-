use soroban_sdk::{contracttype, Address, Env, Symbol};

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct ProjectCreatedEvent {
    pub project_id: u32,
    pub client: Address,
    pub freelancer: Address,
    pub total_amount: i128,
    pub timestamp: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct ProjectPausedEvent {
    pub project_id: u32,
    pub admin: Address,
    pub timestamp: u64,
}

pub fn publish_project_created(
    env: &Env,
    project_id: u32,
    client: &Address,
    freelancer: &Address,
    total_amount: i128,
    timestamp: u64,
) {
    env.events().publish(
        (Symbol::new(env, "PROJECT_CREATED"),),
        ProjectCreatedEvent {
            project_id,
            client: client.clone(),
            freelancer: freelancer.clone(),
            total_amount,
            timestamp,
        },
    );
}

pub fn publish_project_paused(env: &Env, project_id: u32, admin: &Address, timestamp: u64) {
    env.events().publish(
        (Symbol::new(env, "PROJECT_PAUSED"),),
        ProjectPausedEvent {
            project_id,
            admin: admin.clone(),
            timestamp,
        },
    );
}
