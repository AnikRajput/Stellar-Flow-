/**
 * Wizard step 2 — parties.
 *
 * - Freelancer Stellar public key, validated for strkey format and checked
 *   against the connected client wallet (self-hiring is blocked).
 * - Token select. StellarFlow ships with the single configured token
 *   (`VITE_TOKEN_CONTRACT_ID`), so the select is disabled with that one option;
 *   multi-token support would extend this list once token metadata reads land.
 */

import { Field, inputClass } from "@/components/ui/Field";
import type { PartiesValidation } from "@/components/project/create/wizard";
import { CONTRACTS } from "@/config/contracts";
import { shortenAddress } from "@/utils/format";

interface StepPartiesProps {
  freelancer: string;
  token: string;
  onChange: (patch: { freelancer?: string; token?: string }) => void;
  /** Connected wallet address — the project's client. */
  clientAddress: string | null;
  validation: PartiesValidation;
}

const TOKEN_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  {
    value: CONTRACTS.token,
    label: `${shortenAddress(CONTRACTS.token)} · configured via VITE_TOKEN_CONTRACT_ID`,
  },
];

export function StepParties({
  freelancer,
  token,
  onChange,
  clientAddress,
  validation,
}: StepPartiesProps) {
  return (
    <div className="space-y-5">
      <Field
        label="Freelancer wallet address"
        htmlFor="freelancer-address"
        required
        hint={
          clientAddress && !validation.selfAddress
            ? "Must not be your wallet"
            : undefined
        }
        error={validation.error}
      >
        <input
          id="freelancer-address"
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          value={freelancer}
          onChange={(event) => onChange({ freelancer: event.target.value })}
          placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
          aria-invalid={validation.error ? true : undefined}
          className={`${inputClass} font-mono`}
        />
      </Field>

      <Field
        label="Payment token"
        htmlFor="project-token"
        required
        hint="Single supported token"
      >
        <select
          id="project-token"
          value={token}
          disabled={TOKEN_OPTIONS.length <= 1}
          onChange={(event) => onChange({ token: event.target.value })}
          className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-70`}
        >
          {TOKEN_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
