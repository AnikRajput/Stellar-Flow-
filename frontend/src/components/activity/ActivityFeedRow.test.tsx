/**
 * ActivityFeedRow tests (Phase 14).
 *
 * The feed updates live as new events arrive (honest RPC polling). This test
 * proves the ROW is updated IN PLACE on a re-render — the same DOM node stays
 * mounted (no key churn / no full remount) while the summary switches to the
 * new event — which is what makes the live feed feel live instead of a page
 * reload.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityFeedRow } from "@/components/activity/ActivityFeedRow";
import type { ContractEvent } from "@/types/event";

const CLIENT = `G${"C".repeat(55)}`;
const FREELANCER = `G${"F".repeat(55)}`;

const fundedEvent: ContractEvent = {
  contractId: `C${"E".repeat(55)}`,
  ledger: 100,
  topic: "FUNDS_DEPOSITED",
  txHash: "a".repeat(64),
  timestamp: 2000000000,
  data: {
    projectId: 1,
    client: CLIENT,
    amount: "1000000000",
    timestamp: 2000000000,
  },
};

const paidEvent: ContractEvent = {
  contractId: `C${"E".repeat(55)}`,
  ledger: 101,
  topic: "PAYMENT_RELEASED",
  txHash: "b".repeat(64),
  timestamp: 2000000100,
  data: {
    projectId: 1,
    milestoneId: 1,
    freelancer: FREELANCER,
    amount: "500000000",
    timestamp: 2000000100,
  },
};

describe("ActivityFeedRow", () => {
  it("swaps to a newly-arrived event in place without a remount", () => {
    const { container, rerender } = render(
      <ActivityFeedRow event={fundedEvent} />,
    );

    expect(screen.getByText(/Project #1 funded by/)).toBeInTheDocument();
    const row = container.firstElementChild;
    expect(row).not.toBeNull();

    // A new event arrives → same component re-rendered with the new prop.
    rerender(<ActivityFeedRow event={paidEvent} />);

    // Same DOM node — the row was updated, not replaced.
    expect(container.firstElementChild).toBe(row);
    expect(screen.getByText(/Milestone 1 paid on Project #1/)).toBeInTheDocument();
    expect(screen.queryByText(/Project #1 funded by/)).not.toBeInTheDocument();
    // The tx link follows the new event's hash.
    expect(
      container.querySelector(`a[href*="${paidEvent.txHash}"]`),
    ).not.toBeNull();
  });
});
