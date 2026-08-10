use soroban_sdk::{Env, Symbol};

pub fn publish_funds_held(env: &Env, project_id: u32, milestone_id: u32, amount: i128) {
    env.events().publish(
        (Symbol::new(env, "FUNDS_HELD"), project_id, milestone_id),
        amount,
    );
}

pub fn publish_funds_released(env: &Env, project_id: u32, milestone_id: u32, amount: i128) {
    env.events().publish(
        (Symbol::new(env, "FUNDS_RELEASED"), project_id, milestone_id),
        amount,
    );
}

pub fn publish_funds_refunded(env: &Env, project_id: u32, amount: i128) {
    env.events()
        .publish((Symbol::new(env, "FUNDS_REFUNDED"), project_id), amount);
}
