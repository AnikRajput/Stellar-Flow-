#!/usr/bin/env bash
#
# StellarFlow — deploy the three contracts to Testnet (Phase 17).
#
# Deploys in dependency order:
#   1. payment-vault   2. escrow   3. project-factory
#
# Each `stellar contract deploy` returns a contract ID; the IDs are captured
# into shell variables and printed (clearly labeled) at the end. Nothing here
# is initialized — run initialize-testnet.sh afterwards with these IDs.
#
# Required env (placeholders — no keys are hardcoded in this repo):
#   STELLAR_ACCOUNT   the stellar-cli key NAME (added via `stellar keys add`)
#                     or a keypair file path used as --source. Must be funded
#                     on the target network.
#   STELLAR_NETWORK   network name (default: testnet). The network must be
#                     configured in the stellar CLI, e.g.:
#                       stellar network add --global testnet \
#                         --rpc-url https://soroban-testnet.stellar.org \
#                         --network-passphrase "Test SDF Network ; September 2015"
#
# The wasm files come from scripts/build-contracts.sh.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

STELLAR_ACCOUNT="${STELLAR_ACCOUNT:?set STELLAR_ACCOUNT to the key name or keypair path that signs the deploys (e.g. from \`stellar keys add\`)}"
NETWORK="${STELLAR_NETWORK:-testnet}"

# Canonical wasm locations produced by build-contracts.sh.
VAULT_WASM="contracts/payment-vault/target/wasm32-unknown-unknown/release/stellarflow_payment_vault.wasm"
ESCROW_WASM="contracts/escrow/target/wasm32-unknown-unknown/release/stellarflow_escrow.wasm"
FACTORY_WASM="contracts/project-factory/target/wasm32-unknown-unknown/release/stellarflow_project_factory.wasm"

for wasm in "${VAULT_WASM}" "${ESCROW_WASM}" "${FACTORY_WASM}"; do
  if [[ ! -f "${wasm}" ]]; then
    echo "ERROR: missing ${wasm}" >&2
    echo "       run scripts/build-contracts.sh first" >&2
    exit 1
  fi
done

# Deploy one contract and print ONLY the extracted contract ID on stdout
# (progress messages go to stderr so command substitution stays clean).
deploy() {
  local label="$1" wasm="$2"
  local out id
  echo "==> Deploying ${label} (${wasm})" >&2
  out="$(stellar contract deploy --network "${NETWORK}" --source "${STELLAR_ACCOUNT}" --wasm "${wasm}")"
  # The CLI prints the raw C... ID on recent versions but may label it on
  # older ones — extract the first Stellar strkey either way.
  id="$(printf '%s\n' "${out}" | grep -oE '[GC][A-Z2-7]{55}' | head -n 1 || true)"
  if [[ -z "${id}" ]]; then
    echo "ERROR: could not read a contract ID from deploy output:" >&2
    printf '       %s\n' "${out}" >&2
    exit 1
  fi
  printf '%s\n' "${id}"
}

VAULT_ID="$(deploy "payment-vault" "${VAULT_WASM}")"
ESCROW_ID="$(deploy "escrow" "${ESCROW_WASM}")"
FACTORY_ID="$(deploy "project-factory" "${FACTORY_WASM}")"

echo
echo "Deployed contract IDs (keep these for initialize-testnet.sh and frontend/.env):"
echo "  PAYMENT_VAULT  ${VAULT_ID}"
echo "  ESCROW         ${ESCROW_ID}"
echo "  FACTORY        ${FACTORY_ID}"
