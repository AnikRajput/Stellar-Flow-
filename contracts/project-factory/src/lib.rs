#![no_std]

mod errors;
mod events;

#[cfg(test)]
mod test;

use errors::Error;
use soroban_sdk::{
    contract, contractimpl, contracttype, panic_with_error, Address, Env,
};

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Project {
    pub project_id: u32,
    pub client: Address,
    pub freelancer: Address,
    pub token: Address,
    pub total_amount: i128,
    pub paused: bool,
}

#[derive(Clone)]
#[contracttype]
enum DataKey {
    Admin,
    ProjectCount,
    Project(u32),
}

#[contract]
pub struct ProjectFactoryContract;

#[contractimpl]
impl ProjectFactoryContract {
    pub fn initialize(env: Env, admin: Address) {
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::ProjectCount, &0u32);
    }

    pub fn create_project(
        env: Env,
        client: Address,
        freelancer: Address,
        token: Address,
        total_amount: i128,
    ) -> u32 {
        client.require_auth();

        if total_amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let next_project_id = get_project_count_value(&env).saturating_add(1);
        let project = Project {
            project_id: next_project_id,
            client,
            freelancer,
            token,
            total_amount,
            paused: false,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Project(next_project_id), &project);
        env.storage()
            .persistent()
            .set(&DataKey::ProjectCount, &next_project_id);

        // TODO(phase 4): cross-contract call into Escrow

        events::publish_project_created(&env, next_project_id, &project);

        next_project_id
    }

    pub fn get_project(env: Env, project_id: u32) -> Project {
        read_project(&env, project_id)
    }

    pub fn get_project_count(env: Env) -> u32 {
        get_project_count_value(&env)
    }

    pub fn pause_project(env: Env, admin: Address, project_id: u32) {
        admin.require_auth();
        require_admin(&env, &admin);

        let mut project = read_project(&env, project_id);
        project.paused = true;

        env.storage()
            .persistent()
            .set(&DataKey::Project(project_id), &project);

        events::publish_project_paused(&env, project_id, true);
    }

    pub fn unpause_project(env: Env, admin: Address, project_id: u32) {
        admin.require_auth();
        require_admin(&env, &admin);

        let mut project = read_project(&env, project_id);
        project.paused = false;

        env.storage()
            .persistent()
            .set(&DataKey::Project(project_id), &project);

        events::publish_project_paused(&env, project_id, false);
    }

    pub fn transfer_admin(env: Env, current_admin: Address, new_admin: Address) {
        current_admin.require_auth();
        require_admin(&env, &current_admin);

        env.storage().persistent().set(&DataKey::Admin, &new_admin);
    }
}

fn require_admin(env: &Env, admin: &Address) {
    let stored_admin = read_admin(env);
    if stored_admin != *admin {
        panic_with_error!(env, Error::Unauthorized);
    }
}

fn read_admin(env: &Env) -> Address {
    env.storage()
        .persistent()
        .get(&DataKey::Admin)
        .unwrap_or_else(|| panic_with_error!(env, Error::Unauthorized))
}

fn read_project(env: &Env, project_id: u32) -> Project {
    env.storage()
        .persistent()
        .get(&DataKey::Project(project_id))
        .unwrap_or_else(|| panic_with_error!(env, Error::ProjectNotFound))
}

fn get_project_count_value(env: &Env) -> u32 {
    env.storage()
        .persistent()
        .get(&DataKey::ProjectCount)
        .unwrap_or(0u32)
}
