/// <reference types="vite/client" />

/**
 * Typed Vite env surface for StellarFlow.
 *
 * Names mirror `frontend/.env.example` exactly. Every variable is optional in
 * the type; runtime validation (required contracts, valid network) happens in
 * `src/config/contracts.ts`.
 */
interface ImportMetaEnv {
  readonly VITE_STELLAR_NETWORK?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_FACTORY_CONTRACT_ID?: string;
  readonly VITE_ESCROW_CONTRACT_ID?: string;
  readonly VITE_PAYMENT_VAULT_CONTRACT_ID?: string;
  readonly VITE_TOKEN_CONTRACT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
