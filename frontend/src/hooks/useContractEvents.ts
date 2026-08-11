/**
 * Live contract-event hook (Phase 12).
 *
 * `(contractId) => { events, loading }`:
 *  - on mount, loads a recent history page (`fetchEventsPage` — newest first)
 *  - then subscribes to HONEST POLLING (`subscribeToEvents`) continuing from
 *    that page's RPC cursor, so each new on-chain event is PREPENDED live —
 *    no page reload — and nothing is delivered twice
 *
 * New events are capped at `MAX_EVENTS` and deduped by
 * `ledger:txHash:topic` as defense-in-depth (the cursor already guarantees
 * exclusivity; the set guards the history/subscription boundary).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchEventsPage,
  subscribeToEvents,
} from "@/services/events";
import type { ContractEvent } from "@/types/event";

/** Cap on how many events are kept in memory/UI. */
const MAX_EVENTS = 100;

/** Key for dedupe — ledger + tx + topic identifies a published event. */
function eventKey(event: ContractEvent): string {
  return `${event.ledger}:${event.txHash}:${event.topic}`;
}

export interface UseContractEventsReturn {
  events: ContractEvent[];
  loading: boolean;
}

export function useContractEvents(
  contractId: string,
): UseContractEventsReturn {
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const seenRef = useRef<Set<string>>(new Set());

  // Trim the dedupe window so it can't grow unbounded.
  const noteSeen = useCallback((items: ContractEvent[]) => {
    const seen = seenRef.current;
    for (const item of items) {
      seen.add(eventKey(item));
    }
    if (seen.size > MAX_EVENTS * 5) {
      seenRef.current = new Set([...seen].slice(-MAX_EVENTS * 5));
    }
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    seenRef.current = new Set();

    setLoading(true);
    fetchEventsPage(contractId)
      .then((page) => {
        if (!active) return;
        noteSeen(page.events);
        setEvents(page.events.slice(0, MAX_EVENTS));
        setLoading(false);
        // Continue from the history cursor — the first poll only returns
        // events the history page did not already include.
        unsubscribe = subscribeToEvents(
          contractId,
          (event) => {
            const key = eventKey(event);
            if (seenRef.current.has(key)) {
              return;
            }
            noteSeen([event]);
            setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
          },
          { startCursor: page.cursor },
        );
      })
      .catch(() => {
        if (!active) return;
        // History unavailable (RPC down, etc.) — still watch for new events.
        setEvents([]);
        setLoading(false);
        unsubscribe = subscribeToEvents(contractId, (event) => {
          const key = eventKey(event);
          if (seenRef.current.has(key)) {
            return;
          }
          noteSeen([event]);
          setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
        });
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [contractId, noteSeen]);

  return { events, loading };
}
