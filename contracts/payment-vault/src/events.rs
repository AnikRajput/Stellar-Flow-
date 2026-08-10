use soroban_sdk::{contracttype, Address, Env, Symbol};

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct FundsHeldEvent {
    pub project_id: u32,
    pub milestone_id: u32,
    pub from: Address,
    pub amount: i128,
    pub timestamp: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct VaultFundsReleasedEvent {
    pub project_id: u32,
    pub milestone_id: u32,
    pub to: Address,
    pub amount: i128,
    pub timestamp: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct VaultFundsRefundedEvent {
    pub project_id: u32,
    pub to: Address,
    pub amount: i128,
    pub timestamp: u64,
}

pub fn publish_funds_held(
    env: &Env,
    project_id: u32,
    milestone_id: u32,
    from: &Address,
    amount: i128,
    timestamp: u64,
) {
    env.events().publish(
        (Symbol::new(env, "FUNDS_HELD"),),
        FundsHeldEvent {
            project_id,
            milestone_id,
            from: from.clone(),
            amount,
            timestamp,
        },
    );
}

pub fn publish_funds_released(
    env: &Env,
    project_id: u32,
    milestone_id: u32,
    to: &Address,
    amount: i128,
    timestamp: u64,
) {
    env.events().publish(
        (Symbol::new(env, "FUNDS_RELEASED"),),
        VaultFundsReleasedEvent {
            project_id,
            milestone_id,
            to: to.clone(),
            amount,
            timestamp,
        },
    );
}

pub fn publish_funds_refunded(
    env: &Env,
    project_id: u32,
    to: &Address,
    amount: i128,
    timestamp: u64,
) {
    env.events().publish(
        (Symbol::new(env, "FUNDS_REFUNDED"),),
        VaultFundsRefundedEvent {
            project_id,
            to: to.clone(),
            amount,
            timestamp,
        },
    );
}
