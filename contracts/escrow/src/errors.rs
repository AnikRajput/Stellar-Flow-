use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    Unauthorized = 1,
    ProjectNotFound = 2,
    MilestoneNotFound = 3,
    InvalidAmount = 4,
    InvalidState = 5,
    AlreadyPaid = 6,
    AmountMismatch = 7,
    ProjectPaused = 8,
    ProjectNotActive = 9,
    SelfApprovalNotAllowed = 10,
}
