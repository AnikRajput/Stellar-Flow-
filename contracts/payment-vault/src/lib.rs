#![no_std]

mod errors;
mod events;
mod storage;

#[cfg(test)]
mod test;

pub use errors::Error;
pub use storage::DataKey;

use soroban_sdk::{contract, contractimpl, panic_with_error, token, Address, Env};

#[contract]
pub struct PaymentVaultContract;

#[contractimpl]
impl PaymentVaultContract {
    pub fn initialize(env: Env, escrow: Address) {
        env.storage().persistent().set(&DataKey::Escrow, &escrow);
    }

    pub fn hold_funds(
        env: Env,
        from: Address,
        token: Address,
        amount: i128,
        project_id: u32,
        milestone_id: u32,
    ) {
        from.require_auth();
        require_positive_amount(&env, amount);

        token::Client::new(&env, &token).transfer(
            &from,
            &env.current_contract_address(),
            &amount,
        );

        let current_balance = read_vault_balance(&env, project_id);
        let next_balance = checked_add(&env, current_balance, amount);
        write_vault_balance(&env, project_id, next_balance);

        events::publish_funds_held(
            &env,
            project_id,
            milestone_id,
            &from,
            amount,
            env.ledger().timestamp(),
        );
    }

    pub fn release_funds(
        env: Env,
        caller: Address,
        token: Address,
        to: Address,
        amount: i128,
        project_id: u32,
        milestone_id: u32,
    ) {
        require_escrow_caller(&env, &caller);
        require_positive_amount(&env, amount);

        let current_balance = read_vault_balance(&env, project_id);
        if current_balance < amount {
            panic_with_error!(&env, Error::InsufficientBalance);
        }

        token::Client::new(&env, &token).transfer(
            &env.current_contract_address(),
            &to,
            &amount,
        );

        let next_balance = checked_sub(&env, current_balance, amount);
        write_vault_balance(&env, project_id, next_balance);

        events::publish_funds_released(
            &env,
            project_id,
            milestone_id,
            &to,
            amount,
            env.ledger().timestamp(),
        );
    }

    pub fn refund_funds(
        env: Env,
        caller: Address,
        token: Address,
        to: Address,
        amount: i128,
        project_id: u32,
    ) {
        require_escrow_caller(&env, &caller);
        require_positive_amount(&env, amount);

        let current_balance = read_vault_balance(&env, project_id);
        if current_balance < amount {
            panic_with_error!(&env, Error::InsufficientBalance);
        }

        token::Client::new(&env, &token).transfer(
            &env.current_contract_address(),
            &to,
            &amount,
        );

        let next_balance = checked_sub(&env, current_balance, amount);
        write_vault_balance(&env, project_id, next_balance);

        events::publish_funds_refunded(
            &env,
            project_id,
            &to,
            amount,
            env.ledger().timestamp(),
        );
    }

    pub fn get_vault_balance(env: Env, project_id: u32) -> i128 {
        read_vault_balance(&env, project_id)
    }
}

fn require_escrow_caller(env: &Env, caller: &Address) {
    let escrow = read_escrow(env);
    if escrow != *caller {
        panic_with_error!(env, Error::Unauthorized);
    }
}

fn require_positive_amount(env: &Env, amount: i128) {
    if amount <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
}

fn read_escrow(env: &Env) -> Address {
    env.storage()
        .persistent()
        .get(&DataKey::Escrow)
        .unwrap_or_else(|| panic_with_error!(env, Error::Unauthorized))
}

fn read_vault_balance(env: &Env, project_id: u32) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::VaultBalance(project_id))
        .unwrap_or(0i128)
}

fn write_vault_balance(env: &Env, project_id: u32, amount: i128) {
    env.storage()
        .persistent()
        .set(&DataKey::VaultBalance(project_id), &amount);
}

fn checked_add(env: &Env, left: i128, right: i128) -> i128 {
    left.checked_add(right)
        .unwrap_or_else(|| panic_with_error!(env, Error::InvalidAmount))
}

fn checked_sub(env: &Env, left: i128, right: i128) -> i128 {
    left.checked_sub(right)
        .unwrap_or_else(|| panic_with_error!(env, Error::InsufficientBalance))
}
