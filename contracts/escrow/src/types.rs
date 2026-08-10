use soroban_sdk::{contracttype, Address, String};

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum ProjectStatus {
    Active,
    Completed,
    Disputed,
    Cancelled,
    Paused,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum MilestoneStatus {
    Pending,
    Submitted,
    Approved,
    Paid,
    Disputed,
    Cancelled,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Milestone {
    pub id: u32,
    pub name: String,
    pub amount: i128,
    pub status: MilestoneStatus,
    pub due_date: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Project {
    pub id: u32,
    pub client: Address,
    pub freelancer: Address,
    pub token: Address,
    pub total_amount: i128,
    pub escrow_balance: i128,
    pub status: ProjectStatus,
    pub milestone_count: u32,
    pub created_at: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Dispute {
    pub id: u32,
    pub project_id: u32,
    pub milestone_id: u32,
    pub initiator: Address,
    pub reason: String,
    pub resolved: bool,
}
