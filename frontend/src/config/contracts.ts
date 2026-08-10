/**
 * Central Stellar network + contract-address configuration.
 *
 * Values are read from `import.meta.env` (Vite). The canonical variable list
 * lives in `frontend/.env.example`:
 *
 *   VITE_STELLAR_NETWORK          "public" | "testnet" | "futurenet" | "standalone"  (default "testnet")
 *   VITE_RPC_URL                  Soroban RPC endpoint                                (default https://soroban-testnet.stellar.org)
 *   VITE_FACTORY_CONTRACT_ID      project-factory contract address                    (required)
 *   VITE_ESCROW_CONTRACT_ID       escrow contract address                             (required)
 *   VITE_PAYMENT_VAULT_CONTRACT_ID  payment-vault contract address                    (required)
 *   VITE_TOKEN_CONTRACT_ID        token contract address                              (required)
 */

export type NetworkName = "public" | "testnet" | "futurenet" | "standalone";

export interface ContractsConfig {
  /** project-factory contract address (C... on public/testnet networks) */
  factory: string;
  /** escrow contract address */
  escrow: string;
  /** payment-vault contract address */
  vault: string;
  /** token (asset) contract address */
  token: string;
}

const VALID_NETWORKS: readonly NetworkName[] = [
  "public",
  "testnet",
  "futurenet",
  "standalone",
];

/** Throws a descriptive error instead of silently shipping an empty address. */
function requireContractId(envName: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required env var ${envName}. Add it to frontend/.env — see frontend/.env.example for the full list.`,
    );
  }
  return value;
}

/** Narrowing type guard for `NetworkName`. */
function isNetworkName(value: string): value is NetworkName {
  return VALID_NETWORKS.includes(value as NetworkName);
}

function readNetwork(): NetworkName {
  const value = import.meta.env.VITE_STELLAR_NETWORK ?? "testnet";
  if (!isNetworkName(value)) {
    throw new Error(
      `VITE_STELLAR_NETWORK must be one of ${VALID_NETWORKS.join(", ")} (got "${value}").`,
    );
  }
  return value;
}

/** Network this build targets. */
export const NETWORK: NetworkName = readNetwork();

/** Soroban RPC endpoint. */
export const RPC_URL: string =
  import.meta.env.VITE_RPC_URL ?? "https://soroban-testnet.stellar.org";

/** Deployed contract addresses. */
export const CONTRACTS: ContractsConfig = {
  factory: requireContractId(
    "VITE_FACTORY_CONTRACT_ID",
    import.meta.env.VITE_FACTORY_CONTRACT_ID,
  ),
  escrow: requireContractId(
    "VITE_ESCROW_CONTRACT_ID",
    import.meta.env.VITE_ESCROW_CONTRACT_ID,
  ),
  vault: requireContractId(
    "VITE_PAYMENT_VAULT_CONTRACT_ID",
    import.meta.env.VITE_PAYMENT_VAULT_CONTRACT_ID,
  ),
  token: requireContractId(
    "VITE_TOKEN_CONTRACT_ID",
    import.meta.env.VITE_TOKEN_CONTRACT_ID,
  ),
};
