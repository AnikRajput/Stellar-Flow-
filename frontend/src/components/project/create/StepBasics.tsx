/**
 * Wizard step 1 — basics.
 *
 * Name and description are UI metadata: the escrow `Project` struct stores no
 * title, so these fields (shown in the review step and, later, off-chain
 * project records) never reach `create_project`'s on-chain args.
 */

import { Field, inputClass } from "@/components/ui/Field";
import { isBasicsValid } from "@/components/project/create/wizard";

interface StepBasicsProps {
  name: string;
  description: string;
  onChange: (patch: { name?: string; description?: string }) => void;
}

export function StepBasics({ name, description, onChange }: StepBasicsProps) {
  return (
    <div className="space-y-5">
      <Field
        label="Project name"
        htmlFor="project-name"
        required
        hint={isBasicsValid(name) ? "Looks good" : "Required"}
      >
        <input
          id="project-name"
          type="text"
          value={name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="e.g. Landing page redesign"
          className={inputClass}
        />
      </Field>

      <Field
        label="Description"
        htmlFor="project-description"
        hint="Optional"
      >
        <textarea
          id="project-description"
          value={description}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder="Scope, goals, acceptance criteria…"
          rows={4}
          className={`${inputClass} resize-y`}
        />
      </Field>

      <p className="text-[11px] leading-relaxed text-text-muted">
        Name and description are kept as project metadata in the UI — the escrow
        contract itself stores only the parties, amounts, and milestone names
        on-chain.
      </p>
    </div>
  );
}
