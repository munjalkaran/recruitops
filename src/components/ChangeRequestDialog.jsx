import { useMemo, useState } from "react";
import { CANDIDATE_FIELD_LABELS, PROTECTED_FIELDS } from "../constants/pipeline";
import { getRecruiterName } from "../utils/candidateUtils";
import Modal from "./Modal";

export default function ChangeRequestDialog({
  candidate,
  initialField,
  profiles,
  onClose,
  onSubmit,
}) {
  const [fieldName, setFieldName] = useState(initialField || "phone");
  const [proposedValue, setProposedValue] = useState("");
  const [reason, setReason] = useState("");

  const currentValue = useMemo(() => {
    if (!candidate) return "";
    if (fieldName === "owner_id") return getRecruiterName(profiles, candidate.owner_id);
    return candidate[fieldName] ?? "";
  }, [candidate, fieldName, profiles]);

  const submit = (event) => {
    event.preventDefault();
    onSubmit({
      candidate,
      fieldName,
      proposedValue,
      reason,
    });
  };

  return (
    <Modal
      title="Request correction"
      description="Protected fields need Admin approval before they change."
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-bold text-primary">
          Field
          <select
            value={fieldName}
            onChange={(event) => setFieldName(event.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-app bg-raised px-3 text-sm text-primary outline-none"
          >
            {PROTECTED_FIELDS.map((field) => (
              <option key={field} value={field}>
                {CANDIDATE_FIELD_LABELS[field]}
              </option>
            ))}
          </select>
        </label>

        <div>
          <p className="text-sm font-bold text-primary">Current value</p>
          <div className="mt-1 rounded-lg border border-app bg-raised px-3 py-2 text-sm text-secondary">
            {String(currentValue || "-")}
          </div>
        </div>

        <label className="block text-sm font-bold text-primary">
          Proposed value
          <input
            required
            value={proposedValue}
            onChange={(event) => setProposedValue(event.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-app bg-raised px-3 text-sm text-primary outline-none"
          />
        </label>

        <label className="block text-sm font-bold text-primary">
          Reason
          <textarea
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-app bg-raised px-3 py-2 text-sm text-primary outline-none"
            placeholder="Explain why this protected information should change."
          />
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="action-button border border-app bg-surface text-secondary hover:bg-raised hover:text-primary"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="action-button action-primary"
          >
            Submit request
          </button>
        </div>
      </form>
    </Modal>
  );
}
