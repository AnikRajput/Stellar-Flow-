use soroban_sdk::{Env, Symbol};

use crate::Project;

pub fn publish_project_created(env: &Env, project_id: u32, project: &Project) {
    env.events()
        .publish((Symbol::new(env, "PROJECT_CREATED"), project_id), project.clone());
}

pub fn publish_project_paused(env: &Env, project_id: u32, paused: bool) {
    env.events()
        .publish((Symbol::new(env, "PROJECT_PAUSED"), project_id), paused);
}
