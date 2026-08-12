#!/usr/bin/env bash
#
# StellarFlow — initialize the three contracts on Testnet (Phase 17).
#
# Runs AFTER deploy-testnet.sh (all three contract IDs must be known). The
# initialize order satisfies every contract's dependencies:
#
#   1. payment-vault.initialize(escrow)
#        The vault records the ESCROW contract's address at initialize — it
#        authorizes release/refund calls with it. Chicken/egg: the escrow must
#        be DEPLOYED before this call, because the vault has no set_escrow
#        setter (the address is fixed at initialize). deploy-testnet.sh deploys
#        escrow before any initialize runs, so deploy -> initialize works. If
#        you deploy in another order, deploy the escrow first.
#
#   2. escrow.initialize(factory, vault)
#        Stores the factory contract address (the escrow's admin/arbitrator)
#        and the vault address funds flow through.
#
#   3. project-factory.initialize(admin)
#        Stores the governing admin address.
#
# Required env (placeholders — no keys are hardcoded in this repo):
#   STELLAR_ACCOUNT    stellar-cli key name / keypair path signing the calls
#   VAULT_ID           from deploy-testnet.sh
#   ESCROW_ID          from deploy-testnet.sh
#   FACTORY_ID         from deploy-testnet.sh
#   STELLAR_ADMIN      G... address governing the factory. Defaults to the
#                      public key of STELLAR_ACCOUNT (resolved via
#                      `stellar keys address`). Override to delegate elsewhere.
#   TOKEN_CONTRACT_ID  token contract (e.g. the XLM SAC or a deployed token)
#                      the app uses. NOT deployed by these scripts — supply it.
#   STELLAR_NETWORK    network name (default: testnet)
#   STELLAR_RPC_URL    RPC used in the printed frontend/.env block
#
# Nothing here pretends to succeed: every command exits non-zero on failure
# and the final .env block only prints if all three initializes returned 0.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

STELLAR_ACCOUNT="${STELLAR_ACCOUNT:?set STELLAR_ACCOUNT to the key name or keypair path signing the initializes (e.g. from \`stellar keys add\`)}"
VAULT_ID="${VAULT_ID:?set VAULT_ID — the payment-vault contract ID from deploy-testnet.sh}"
ESCROW_ID="${ESCROW_ID:?set ESCROW_ID — the escrow contract ID from deploy-testnet.sh}"
FACTORY_ID="${FACTORY_ID:?set FACTORY_ID — the project-factory contract ID from deploy-testnet.sh}"
TOKEN_CONTRACT_ID="${TOKEN_CONTRACT_ID:?set TOKEN_CONTRACT_ID — the token contract (SAC) the app will use}"
NETWORK="${STELLAR_NETWORK:-testnet}"
RPC_URL="${STELLAR_RPC_URL:-https://soroban-testnet.stellar.org}"

# Factory admin address: explicit STELLAR_ADMIN, else the deploy account's
# public key (resolved from the stellar-cli keyring).
ADMIN_ADDRESS="${STELLAR_ADMIN:-}"
if [[ -z "${ADMIN_ADDRESS}" ]]; then
  if ! ADMIN_ADDRESS="$(stellar keys address "${STELLAR_ACCOUNT}" 2>/dev/null)"; then
    echo "ERROR: could not resolve the public key for STELLAR_ACCOUNT=\"${STELLAR_ACCOUNT}\"" >&2
    echo "       set STELLAR_ADMIN to the G... admin address explicitly (required when" >&2
    echo "       STELLAR_ACCOUNT is a keypair file path, not a \`stellar keys\` name)." >&2
    exit 1
  fi
  echo "Resolved STELLAR_ACCOUNT public key -> ${ADMIN_ADDRESS}"
fi

# Invoke a contract function, submitting state changes.
#
# Recent stellar-cli versions SIMULATE `invoke` unless --send=yes is passed;
# older versions send automatically and reject the flag. Detect support from
# the command's own help text (once) so both work without editing this file.
# Note: these commands assume a recent stellar-cli (v21+); older versions
# would fail loudly with their own clear errors.
send_args=()
if stellar contract invoke --help 2>&1 | grep -q -- '--send'; then
  send_args+=(--send=yes)
fi

invoke() {
  local id="$1"
  shift
  # "${send_args[@]}" with an empty array requires bash 4.4+ (fine on
  # GitHub Actions ubuntu and Git Bash; macOS ships older bash).
  stellar contract invoke \
    --id "${id}" \
    --source "${STELLAR_ACCOUNT}" \
    --network "${NETWORK}" \
    "${send_args[@]}" \
    -- "$@"
}

echo "==> vault.initialize(escrow=${ESCROW_ID})"
invoke "${VAULT_ID}" initialize "${ESCROW_ID}"

echo "==> escrow.initialize(factory=${FACTORY_ID}, vault=${VAULT_ID})"
invoke "${ESCROW_ID}" initialize "${FACTORY_ID}" "${VAULT_ID}"

echo "==> factory.initialize(admin=${ADMIN_ADDRESS})"
invoke "${FACTORY_ID}" initialize "${ADMIN_ADDRESS}"

echo
echo "All three contracts initialized on ${NETWORK}."
echo
echo "Ready-to-paste frontend/.env block (matches frontend/.env.example):"
cat <<EOF
VITE_STELLAR_NETWORK=${NETWORK}
VITE_RPC_URL=${RPC_URL}
VITE_FACTORY_CONTRACT_ID=${FACTORY_ID}
VITE_ESCROW_CONTRACT_ID=${ESCROW_ID}
VITE_PAYMENT_VAULT_CONTRACT_ID=${VAULT_ID}
VITE_TOKEN_CONTRACT_ID=${TOKEN_CONTRACT_ID}
EOF
