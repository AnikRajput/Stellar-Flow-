/**
 * Activity page — redesigned for premium look.
 *
 * Filterable table of escrow contract on-chain events, driven by
 * `useContractEvents(CONTRACTS.escrow)`. New events append live via polling.
 */

import { useMemo, useState } from "react";
import { SidebarNav, type NavItemId } from "@/components/layout/SidebarNav";
import { TopHeader } from "@/components/layout/TopHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
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
import { CONTRACTS } from "@/config/contracts";

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

const COLUMN_LABELS = [
  "Event",
  "Project",
  "Amount",
  "Wallet",
  "Tx hash",
  "Time",
  "Status",
] as const;

const MOBILE_TD_CLASS =
  "block px-4 py-1.5 md:table-cell md:px-4 md:py-3 before:mr-2 before:text-[10px] before:font-medium before:uppercase before:tracking-wider before:text-text-muted before:content-[attr(data-label)] md:before:hidden";

interface ActivityProps {
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
    <div className="flex min-h-screen flex-col md:flex-row">
      <SidebarNav active="activity" onNavigate={onNavigate} />

      <main className="min-w-0 flex-1">
        <TopHeader
          title="Activity"
          subtitle="On-chain events from the escrow contract."
          wallet={wallet}
        />

        <div className="px-6 py-6 lg:px-8">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <span>Type</span>
              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(event.target.value as TypeFilter)
                }
                className="rounded-lg border border-border-default bg-surface-2/80 px-3 py-1.5 text-[13px] text-text-primary outline-none transition-colors focus:border-accent-500"
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
              className="w-full max-w-xs rounded-lg border border-border-default bg-surface-2/80 px-3 py-1.5 text-[13px] text-text-primary placeholder:text-text-muted outline-none transition-colors focus:border-accent-500"
            />

            <p className="ml-auto text-[11px] text-text-tertiary">
              Live · polls RPC every ~5s
            </p>
          </div>

          {/* Table */}
          <div className="mt-4 overflow-x-auto rounded-xl border border-border-subtle bg-surface-2/40">
            <table className="w-full border-collapse text-[13px] md:min-w-[720px]">
              <thead className="hidden md:table-header-group">
                <tr className="border-b border-border-subtle text-left text-[11px] uppercase tracking-wider text-text-muted">
                  <th className="px-4 py-3 font-medium">Event</th>
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Wallet</th>
                  <th className="px-4 py-3 font-medium">Tx hash</th>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="block md:table-row-group">
                {loading ? (
                  Array.from({ length: 5 }, (_, index) => (
                    <tr
                      key={index}
                      className="block border-b border-border-subtle/60 last:border-0 md:table-row"
                    >
                      {COLUMN_LABELS.map((label, cell) => (
                        <td key={cell} data-label={label} className={MOBILE_TD_CLASS}>
                          <Skeleton className="h-3.5 w-full rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr className="block md:table-row">
                    <td
                      colSpan={7}
                      className="block px-4 py-10 text-center md:table-cell"
                    >
                      <p className="text-sm font-medium text-text-secondary">
                        {events.length === 0
                          ? "No activity yet"
                          : "No events match your filters"}
                      </p>
                      <p className="mt-1 text-xs text-text-tertiary">
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
        </div>
      </main>
    </div>
  );
}

function ActivityRow({ event }: { event: ContractEvent }) {
  const meta = eventMeta(event);
  return (
    <tr className="block border-b border-border-subtle/60 transition-colors last:border-0 hover:bg-surface-3/30 md:table-row">
      <td data-label="Event" className={MOBILE_TD_CLASS}>
        <span className="font-medium text-text-primary">{event.topic}</span>
      </td>
      <td data-label="Project" className={MOBILE_TD_CLASS}>
        <span className="tabular-nums text-text-secondary">
          {meta.projectId !== null ? `#${meta.projectId}` : "—"}
        </span>
      </td>
      <td data-label="Amount" className={MOBILE_TD_CLASS}>
        <span className="tabular-nums text-text-secondary">
          {meta.amountStroops
            ? `${formatStroopsAsUnits(meta.amountStroops)} XLM`
            : "—"}
        </span>
      </td>
      <td data-label="Wallet" className={MOBILE_TD_CLASS}>
        {meta.wallet ? (
          <span
            className="font-mono text-[11px] text-text-secondary"
            title={meta.wallet}
          >
            {shortenAddress(meta.wallet)}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td data-label="Tx hash" className={MOBILE_TD_CLASS}>
        <a
          href={explorerTxUrl(event.txHash)}
          target="_blank"
          rel="noopener noreferrer"
          title={event.txHash}
          className="break-all font-mono text-[11px] text-accent-400 underline decoration-accent-500/30 underline-offset-2 transition-colors hover:text-accent-300"
        >
          {shortenAddress(event.txHash)}
        </a>
      </td>
      <td data-label="Time" className={MOBILE_TD_CLASS}>
        <span className="text-[11px] text-text-tertiary">
          {relativeTime(event.timestamp)}
        </span>
      </td>
      <td data-label="Status" className={MOBILE_TD_CLASS}>
        <span className="text-[11px] font-medium text-text-secondary">
          {meta.statusLabel}
        </span>
      </td>
    </tr>
  );
}
