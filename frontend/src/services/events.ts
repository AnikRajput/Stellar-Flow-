import type { ContractEvent } from "@/types/event";

/** Callback receiving a single decoded contract event. */
export type EventListener = (event: ContractEvent) => void;

/**
 * Fetches historical events emitted by a contract.
 * @param contractId Contract address to filter on.
 * @param startLedger Optional earliest ledger to scan from.
 */
export async function fetchEvents(
  contractId: string,
  startLedger?: number,
): Promise<ContractEvent[]> {
  void contractId;
  void startLedger;
  throw new Error("fetchEvents is not implemented yet — wired up in Phase 12.");
}

/**
 * Subscribes to live events emitted by a contract.
 * @param contractId Contract address to watch.
 * @param onEvent Called for each decoded event.
 * @returns An unsubscribe function.
 */
export function subscribeToEvents(
  contractId: string,
  onEvent: EventListener,
): () => void {
  void contractId;
  void onEvent;
  throw new Error(
    "subscribeToEvents is not implemented yet — wired up in Phase 12.",
  );
}
