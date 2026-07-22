import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { getRecruiterName } from "../utils/candidateUtils";
import Modal from "./Modal";

export default function CsvImportDialog({
  rows,
  profiles,
  duplicateWarnings,
  onAssignOwner,
  onCancel,
  onImport,
}) {
  const warningsCount = useMemo(
    () => rows.filter((row) => !row.name).length + Object.values(duplicateWarnings).flat().length,
    [duplicateWarnings, rows],
  );

  return (
    <Modal
      title="Preview CSV import"
      description="Review validation and duplicate warnings before importing."
      onClose={onCancel}
      size="max-w-5xl"
    >
      <div className="space-y-4">
        {warningsCount ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p>
              {warningsCount} warning{warningsCount === 1 ? "" : "s"} found. Duplicate warnings do
              not block import.
            </p>
          </div>
        ) : null}

        <div className="max-h-[50vh] overflow-auto rounded-lg border border-app">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="sticky top-0 bg-raised text-xs uppercase text-secondary">
              <tr>
                <th className="px-3 py-2">Candidate</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Target Bank</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Owner</th>
                <th className="px-3 py-2">Warnings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {rows.map((row, index) => {
                const rowWarnings = duplicateWarnings[row.id] || [];
                return (
                  <tr key={row.id}>
                    <td className="px-3 py-2 font-bold text-primary">{row.name || "Missing name"}</td>
                    <td className="px-3 py-2 text-secondary">{row.phone || "-"}</td>
                    <td className="px-3 py-2 text-secondary">{row.email || "-"}</td>
                    <td className="px-3 py-2 text-secondary">{row.target_bank || "-"}</td>
                    <td className="px-3 py-2 text-secondary">{row.role || "-"}</td>
                    <td className="px-3 py-2">
                      <select
                        value={row.owner_id || ""}
                        onChange={(event) => onAssignOwner(index, event.target.value || null)}
                        className="h-9 rounded-lg border border-app bg-raised px-2 text-sm text-primary"
                        aria-label={`Owner for ${row.name || "row"}`}
                      >
                        <option value="">Unassigned</option>
                        {profiles.map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {profile.full_name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-xs text-secondary">
                      {!row.name ? <p>Candidate name is required.</p> : null}
                      {rowWarnings.map((warning) => (
                        <p key={warning.candidate.id}>
                          {warning.matchType} with {warning.candidate.name} (
                          {getRecruiterName(profiles, warning.candidate.owner_id)})
                        </p>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="action-button border border-app bg-surface text-secondary hover:bg-raised hover:text-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onImport}
            className="action-button bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-400 dark:text-zinc-950"
          >
            Import anyway
          </button>
        </div>
      </div>
    </Modal>
  );
}
