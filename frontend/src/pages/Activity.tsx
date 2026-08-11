/**
 * Activity page (Phase 12).
 *
 * A filterable table of the escrow contract's on-chain events, driven by
 * `useContractEvents(CONTRACTS.escrow)`: a recent history page on mount, then
 * new events APPEND LIVE via honest polling (Soroban RPC has no push channel —
 * the page notes the ~5s poll interval). Filter by event type and search
 * across project / wallet / tx hash / summary.
 *
 * Honesty notes: the history window covers the last
 * `DEFAULT_HISTORY_LOOKBACK_LEDGERS` ledgers (testnet ≈ a few hours), and if
 * the RPC is unreachable the table shows an empty state while polling
 * continues — no fabricated events.
 */

import { useMemo, useState } from "react";
import { SidebarNav, type NavItemId } from "@/components/layout/SidebarNav";
import { Skeleton } from "@/components/ui/Skeleton";
import { WalletButton } from "@/components/wallet/WalletButton";
import { CONTRACTS } from "@/config/contracts";
import { useContractEvents } from "@/hooks/useContractEvents";
import { useWallet } from "@/hooks/useWallet";
import type { ContractEvent, ContractEventName } from "@/types/event";
import {
  explorerTxUrl,
  formatStroopsAsUnits,
  relativeTime,
  shortenAddress,
} from "@/utils/format";
import { eventMeta } from "@/utils/eventMeta";

const ALL_EVENT_TYPES: readonly ContractEventName[] = [
  "FUNDS_DEPOSITED",
  "MILESTONE_CREATED",
  "MILESTONE_SUBMITTED",
  "MILESTONE_APPROVED",
  "PAYMENT_RELEASED",
  "DISPUTE_OPENED",
  "DISPUTE_RESOLVED",
  "PROJECT_CANCELLED",
  "REFUND_ISSUED",
  "PROJECT_COMPLETED",
];

type TypeFilter = "all" | ContractEventName;

interface ActivityProps {
  /** App-shell nav wiring — forwarded to the page's SidebarNav. */
  onNavigate?: (id: NavItemId) => void;
}

export function Activity({ onNavigate }: ActivityProps) {
  const wallet = useWallet();
  const { events, loading } = useContractEvents(CONTRACTS.escrow);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return events.filter((event) => {
      if (typeFilter !== "all" && event.topic !== typeFilter) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const meta = eventMeta(event);
      return (
        String(meta.projectId ?? "").includes(needle) ||
        event.txHash.toLowerCase().includes(needle) ||
        (meta.wallet ?? "").toLowerCase().includes(needle) ||
        meta.summary.toLowerCase().includes(needle)
      );
    });
  }, [events, typeFilter, query]);

  return (
    <div className="flex min-h-screen">
      <SidebarNav active="activity" onNavigate={onNavigate} />

      <main className="min-w-0 flex-1 px-6 py-8 md:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink-50">
              Activity
            </h1>
            <p className="mt-1 text-sm text-ink-400">
              On-chain events from the escrow contract.
            </p>
          </div>
          <WalletButton wallet={wallet} />
        </header>

        {/* Filters */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-ink-400">
            <span>Type</span>
            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(event.target.value as TypeFilter)
              }
              className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-100 outline-none transition-colors focus:border-navy-500"
            >
              <option value="all">All events</option>
              {ALL_EVENT_TYPES.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          </label>

          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search project, wallet, tx hash…"
            aria-label="Search events"
            className="w-full max-w-xs rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 outline-none transition-colors focus:border-navy-500"
          />

          <p className="ml-auto text-xs text-ink-400">
            Live — polls the RPC every ~5s
          </p>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto rounded-2xl border border-ink-800 bg-ink-900/60">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink-800 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Project</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Wallet</th>
                <th className="px-4 py-3 font-medium">Tx hash</th>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }, (_, index) => (
                  <tr key={index} className="border-b border-ink-800/60 last:border-0">
                    {Array.from({ length: 7 }, (_, cell) => (
                      <td key={cell} className="px-4 py-3">
                        <Skeleton className="h-4 w-full rounded-md" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <p className="text-sm font-medium text-ink-200">
                      {events.length === 0
                        ? "No activity yet"
                        : "No events match your filters"}
                    </p>
                    <p className="mt-1 text-xs text-ink-400">
                      {events.length === 0
                        ? "Events emitted by the escrow contract appear here as they land on-chain."
                        : "Try a different event type or search term."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((event, index) => (
                  <ActivityRow
                    key={`${event.ledger}:${event.txHash}:${event.topic}:${index}`}
                    event={event}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function ActivityRow({ event }: { event: ContractEvent }) {
  const meta = eventMeta(event);
  return (
    <tr className="border-b border-ink-800/60 transition-colors last:border-0 hover:bg-ink-800/30">
      <td className="px-4 py-3">
        <span className="font-medium text-ink-100">{event.topic}</span>
      </td>
      <td className="px-4 py-3 tabular-nums text-ink-300">
        {meta.projectId !== null ? `#${meta.projectId}` : "—"}
      </td>
      <td className="px-4 py-3 tabular-nums text-ink-300">
        {meta.amountStroops
          ? `${formatStroopsAsUnits(meta.amountStroops)} XLM`
          : "—"}
      </td>
      <td className="px-4 py-3">
        {meta.wallet ? (
          <span className="font-mono text-xs text-ink-300" title={meta.wallet}>
            {shortenAddress(meta.wallet)}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-3">
        <a
          href={explorerTxUrl(event.txHash)}
          target="_blank"
          rel="noopener noreferrer"
          title={event.txHash}
          className="font-mono text-xs text-navy-300 underline decoration-navy-500/40 underline-offset-2 transition-colors hover:text-navy-200"
        >
          {shortenAddress(event.txHash)}
        </a>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-xs text-ink-400">
        {relativeTime(event.timestamp)}
      </td>
      <td className="px-4 py-3">
        <span className="text-xs font-medium text-ink-200">
          {meta.statusLabel}
        </span>
      </td>
    </tr>
  );
}
