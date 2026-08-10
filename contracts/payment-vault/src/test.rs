extern crate std;

use soroban_sdk::{
    testutils::Address as _,
    token::{self, StellarAssetClient},
    Address, Env,
};

use crate::{Error, PaymentVaultContract, PaymentVaultContractClient};

fn setup() -> (Env, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let escrow = Address::generate(&env);
    let vault_id = env.register(PaymentVaultContract, ());
    let vault = PaymentVaultContractClient::new(&env, &vault_id);
    vault.initialize(&escrow);

    let token_admin = Address::generate(&env);
    let token = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_address = token.address();
    let user = Address::generate(&env);

    StellarAssetClient::new(&env, &token_address).mint(&user, &2_000i128);

    (env, vault_id, escrow, user, token_address)
}

#[test]
fn hold_funds_success() {
    let (env, vault_id, _escrow, user, token_address) = setup();
    let vault = PaymentVaultContractClient::new(&env, &vault_id);
    let token_client = token::Client::new(&env, &token_address);

    vault.hold_funds(&user, &token_address, &300i128, &1u32, &1u32);

    assert_eq!(vault.get_vault_balance(&1u32), 300);
    assert_eq!(token_client.balance(&user), 1_700);
    assert_eq!(token_client.balance(&vault_id), 300);
}

#[test]
fn release_funds_by_escrow_success() {
    let (env, vault_id, escrow, user, token_address) = setup();
    let vault = PaymentVaultContractClient::new(&env, &vault_id);
    let recipient = Address::generate(&env);
    let token_client = token::Client::new(&env, &token_address);

    vault.hold_funds(&user, &token_address, &450i128, &7u32, &1u32);
    vault.release_funds(
        &escrow,
        &token_address,
        &recipient,
        &450i128,
        &7u32,
        &1u32,
    );

    assert_eq!(vault.get_vault_balance(&7u32), 0);
    assert_eq!(token_client.balance(&vault_id), 0);
    assert_eq!(token_client.balance(&recipient), 450);
}

#[test]
fn release_funds_by_non_escrow_rejected() {
    let (env, vault_id, _escrow, user, token_address) = setup();
    let vault = PaymentVaultContractClient::new(&env, &vault_id);
    let outsider = Address::generate(&env);
    let recipient = Address::generate(&env);

    vault.hold_funds(&user, &token_address, &200i128, &2u32, &1u32);

    let result = vault.try_release_funds(
        &outsider,
        &token_address,
        &recipient,
        &200i128,
        &2u32,
        &1u32,
    );

    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn refund_funds_by_escrow_success() {
    let (env, vault_id, escrow, user, token_address) = setup();
    let vault = PaymentVaultContractClient::new(&env, &vault_id);
    let token_client = token::Client::new(&env, &token_address);

    vault.hold_funds(&user, &token_address, &275i128, &3u32, &0u32);
    vault.refund_funds(&escrow, &token_address, &user, &275i128, &3u32);

    assert_eq!(vault.get_vault_balance(&3u32), 0);
    assert_eq!(token_client.balance(&vault_id), 0);
    assert_eq!(token_client.balance(&user), 2_000);
}

#[test]
fn get_vault_balance_reflects_holds() {
    let (env, vault_id, _escrow, user, token_address) = setup();
    let vault = PaymentVaultContractClient::new(&env, &vault_id);

    vault.hold_funds(&user, &token_address, &100i128, &9u32, &1u32);
    vault.hold_funds(&user, &token_address, &250i128, &9u32, &2u32);

    assert_eq!(vault.get_vault_balance(&9u32), 350);
}
