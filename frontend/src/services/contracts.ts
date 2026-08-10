import { Contract } from "@stellar/stellar-sdk";
import { CONTRACTS } from "@/config/contracts";

/** project-factory contract instance (address from VITE_FACTORY_CONTRACT_ID). */
export function getFactoryContract(): Contract {
  return new Contract(CONTRACTS.factory);
}

/** escrow contract instance (address from VITE_ESCROW_CONTRACT_ID). */
export function getEscrowContract(): Contract {
  return new Contract(CONTRACTS.escrow);
}

/** payment-vault contract instance (address from VITE_PAYMENT_VAULT_CONTRACT_ID). */
export function getVaultContract(): Contract {
  return new Contract(CONTRACTS.vault);
}
