use soroban_sdk::contracttype;

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Factory,
    Vault,
    ProjectCount,
    DisputeCount,
    Paused,
    Project(u32),
    Milestone(u32, u32),
    MilestoneAmountSum(u32),
    PaidMilestoneCount(u32),
    Dispute(u32),
}
