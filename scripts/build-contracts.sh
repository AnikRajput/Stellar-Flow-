#!/usr/bin/env bash
#
# StellarFlow — build the three Soroban contracts (Phase 17).
#
# Runs `stellar contract build` for each workspace crate and copies the
# resulting .wasm into a canonical per-contract path that deploy-testnet.sh
# and the CI deploy workflow (.github/workflows/deploy.yml) both already use:
#
#   contracts/<crate>/target/wasm32-unknown-unknown/release/<crate>.wasm
#
# (That directory is gitignored — artifacts are produced, never committed.)
#
# Prerequisites:
#   - `stellar` CLI on PATH  (https://github.com/stellar/stellar-cli)
#   - the wasm32 Rust target for the Soroban SDK. The CLI usually installs it
#     on first build; if not:  rustup target add wasm32-unknown-unknown
#
# No network access, no accounts needed — this step is purely local.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

# crate dir -> Cargo package name (contracts/*/Cargo.toml `[package] name`).
declare -A CRATES=(
  [payment-vault]=stellarflow-payment-vault
  [escrow]=stellarflow-escrow
  [project-factory]=stellarflow-project-factory
)

# Deploy order is vault -> escrow -> factory; keep the same order here.
for crate in payment-vault escrow project-factory; do
  package="${CRATES[$crate]}"
  # Cargo names cdylib artifacts after the LIB crate name (hyphens -> underscores).
  wasm_name="${package//-/_}.wasm"

  echo "==> Building ${package} ..."
  stellar contract build --package "${package}"

  # Locate the freshly built wasm. The exact target subdir varies by
  # CLI/SDK version (wasm32-unknown-unknown vs wasm32v1-none), so find it.
  wasm="$(find target -type f -name "${wasm_name}" -path '*/release/*' -print -quit 2>/dev/null || true)"
  if [[ -z "${wasm}" ]]; then
    echo "ERROR: no ${wasm_name} produced for ${package} (searched target/**/release/)" >&2
    echo "       is the stellar CLI version compatible with contracts/Cargo.toml?" >&2
    exit 1
  fi

  dest="contracts/${crate}/target/wasm32-unknown-unknown/release/${wasm_name}"
  mkdir -p "$(dirname "${dest}")"
  cp "${wasm}" "${dest}"

  echo "    -> ${dest}"
done

echo
echo "All contracts built. To deploy:"
echo "  STELLAR_ACCOUNT=<key-name-or-path> ./scripts/deploy-testnet.sh"
