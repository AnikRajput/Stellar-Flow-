use soroban_sdk::{Env, String, Symbol};

pub fn publish_funds_deposited(env: &Env, project_id: u32, amount: i128) {
    env.events()
        .publish((Symbol::new(env, "FUNDS_DEPOSITED"), project_id), amount);
}

pub fn publish_milestone_created(env: &Env, project_id: u32, milestone_id: u32, amount: i128) {
    env.events().publish(
        (Symbol::new(env, "MILESTONE_CREATED"), project_id, milestone_id),
        amount,
    );
}

pub fn publish_milestone_submitted(env: &Env, project_id: u32, milestone_id: u32) {
    env.events().publish(
        (Symbol::new(env, "MILESTONE_SUBMITTED"), project_id, milestone_id),
        (),
    );
}

pub fn publish_milestone_approved(env: &Env, project_id: u32, milestone_id: u32) {
    env.events().publish(
        (Symbol::new(env, "MILESTONE_APPROVED"), project_id, milestone_id),
        (),
    );
}

pub fn publish_dispute_opened(env: &Env, dispute_id: u32, project_id: u32, milestone_id: u32) {
    env.events().publish(
        (
            Symbol::new(env, "DISPUTE_OPENED"),
            dispute_id,
            project_id,
            milestone_id,
        ),
        (),
    );
}

pub fn publish_dispute_resolved(env: &Env, dispute_id: u32, release_to_freelancer: bool) {
    env.events().publish(
        (Symbol::new(env, "DISPUTE_RESOLVED"), dispute_id),
        release_to_freelancer,
    );
}

pub fn publish_project_cancelled(env: &Env, project_id: u32) {
    env.events()
        .publish((Symbol::new(env, "PROJECT_CANCELLED"), project_id), ());
}

pub fn publish_refund_issued(env: &Env, project_id: u32, amount: i128) {
    env.events()
        .publish((Symbol::new(env, "REFUND_ISSUED"), project_id), amount);
}

pub fn publish_project_completed(env: &Env, project_id: u32) {
    env.events()
        .publish((Symbol::new(env, "PROJECT_COMPLETED"), project_id), ());
}

pub fn publish_dispute_reason(env: &Env, dispute_id: u32, reason: &String) {
    env.events()
        .publish((Symbol::new(env, "DISPUTE_REASON"), dispute_id), reason.clone());
}
