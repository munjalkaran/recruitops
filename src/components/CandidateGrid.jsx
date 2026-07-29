import {
  AlertTriangle,
  Archive,
  Mail,
  ShieldAlert,
  Trash2,
  Undo2,
} from "lucide-react";
import StagePill from "./StagePill";
import DocsPill from "./DocsPill";
import {
  formatCurrency,
  formatExperience,
  getRecruiterName,
  isCandidateStale,
} from "../utils/candidateUtils";
import {
  canArchiveCandidate,
  canDirectlyEditCandidateField,
  canPermanentlyDeleteCandidate,
  canRequestCandidateChange,
  canRestoreCandidate,
} from "../utils/permissions";

const columns = [
  { label: "Candidate", key: "name", width: "min-w-56" },
  { label: "Phone", key: "phone", width: "min-w-36" },
  { label: "Email", key: "email", width: "min-w-56" },
  { label: "Current Employer", key: "current_employer", width: "min-w-48" },
  { label: "Experience", key: "experience_years", width: "min-w-32" },
  { label: "Target Bank", key: "target_bank", width: "min-w-48" },
  { label: "Role", key: "role", width: "min-w-48" },
  { label: "Stage", key: "stage", width: "min-w-40" },
  { label: "Recruiter", key: "owner_id", width: "min-w-44" },
  { label: "Documents", key: "docs_status", width: "min-w-36" },
  { label: "Fee ₹", key: "fee", width: "min-w-32" },
  { label: "Next Follow-up", key: "next_follow_up", width: "min-w-40" },
  { label: "Last Contact", key: "last_contact", width: "min-w-40" },
  { label: "Notes", key: "notes", width: "min-w-80" },
  { label: "Actions", key: "actions", width: "min-w-48" },
];

const typeByField = {
  email: "email",
  experience_years: "number",
  fee: "number",
  next_follow_up: "date",
  last_contact: "date",
};

export default function CandidateGrid({
  candidates,
  allCandidates,
  profiles,
  activeProfile,
  duplicateWarningsByCandidate,
  dismissedDuplicateKeys,
  onUpdateCandidate,
  onRequestCorrection,
  onArchiveCandidate,
  onRestoreCandidate,
  onDeleteCandidate,
  onOpenEmailDraft,
  onOpenDuplicate,
  onDismissDuplicate,
  onLinkDuplicate,
  emptyMessage = "No candidates match the current filters.",
  archivedMode = false,
}) {
  const renderTextInput = (candidate, field, extraClass = "") => {
    const canEdit = canDirectlyEditCandidateField(activeProfile, candidate, field);
    const canRequest = canRequestCandidateChange(activeProfile, candidate, field);
    const value = candidate[field] ?? "";

    if (!canEdit) {
      return (
        <div className="flex min-h-10 items-center gap-2 px-3 py-2 text-sm text-primary">
          <span className="truncate">{field === "experience_years" ? formatExperience(value) : value || "-"}</span>
          {canRequest ? (
            <button
              type="button"
              onClick={() => onRequestCorrection(candidate, field)}
              className="shrink-0 rounded-md p-1 text-secondary hover:bg-raised hover:text-teal-700"
              aria-label={`Request correction for ${field}`}
              title="Request correction"
            >
              <ShieldAlert size={14} />
            </button>
          ) : null}
        </div>
      );
    }

    return (
      <input
        type={typeByField[field] || "text"}
        min={field === "fee" || field === "experience_years" ? "0" : undefined}
        step={field === "experience_years" ? "0.5" : undefined}
        value={value}
        onChange={(event) => {
          const raw = event.target.value;
          const nextValue =
            field === "fee" || field === "experience_years"
              ? raw === ""
                ? ""
                : Number(raw)
              : raw;
          onUpdateCandidate(candidate.id, field, nextValue);
        }}
        className={`sheet-input ${extraClass}`}
      />
    );
  };

  return (
    <div className="overflow-hidden rounded-lg border border-app bg-surface">
      <div className="max-h-[calc(100vh-330px)] min-h-[420px] overflow-auto">
        <table className="w-full min-w-[2320px] border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-raised text-[11px] uppercase text-secondary">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`${column.width} border-b border-app px-3 py-2.5 font-semibold tracking-wide`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)] text-sm">
            {candidates.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-secondary">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              candidates.map((candidate) => {
                const stale = isCandidateStale(candidate);
                const duplicateWarnings = (duplicateWarningsByCandidate[candidate.id] || []).filter(
                  (warning) => !dismissedDuplicateKeys.has(`${candidate.id}:${warning.candidate.id}`),
                );
                const firstWarning = duplicateWarnings[0];

                return (
                  <tr
                    key={candidate.id}
                    className={`transition hover:bg-teal-50/40 dark:hover:bg-zinc-800/70 ${
                      stale
                        ? "bg-amber-50 dark:bg-amber-950/20"
                        : candidate.is_archived
                          ? "bg-zinc-50 text-secondary dark:bg-zinc-900/40"
                          : "bg-surface"
                    }`}
                  >
                    <td className="border-r border-app">
                      <div className="flex items-center gap-1.5 pl-3">
                        {stale ? (
                          <AlertTriangle
                            size={14}
                            strokeWidth={2.2}
                            className="shrink-0 text-amber-600"
                            aria-label="Overdue follow-up"
                          />
                        ) : (
                          <span className="w-3.5 shrink-0" />
                        )}
                        {renderTextInput(candidate, "name", "px-0 font-bold")}
                        {candidate.is_demo ? (
                          <span className="mr-2 shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:bg-sky-950 dark:text-sky-200">
                            Sample
                          </span>
                        ) : null}
                      </div>
                      {firstWarning ? (
                        <div className="ml-8 mb-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                          <button
                            type="button"
                            onClick={() => onOpenDuplicate(candidate, firstWarning)}
                            className="font-bold underline-offset-2 hover:underline"
                          >
                            Possible previous candidate found
                          </button>
                        </div>
                      ) : null}
                    </td>
                    <td>{renderTextInput(candidate, "phone", "tabular-nums")}</td>
                    <td>{renderTextInput(candidate, "email")}</td>
                    <td>{renderTextInput(candidate, "current_employer")}</td>
                    <td>{renderTextInput(candidate, "experience_years", "text-center")}</td>
                    <td>{renderTextInput(candidate, "target_bank", "font-semibold")}</td>
                    <td>{renderTextInput(candidate, "role")}</td>
                    <td className="px-3 py-2">
                      <StagePill
                        value={candidate.stage}
                        disabled={!canDirectlyEditCandidateField(activeProfile, candidate, "stage")}
                        onChange={(value) => onUpdateCandidate(candidate.id, "stage", value)}
                      />
                    </td>
                    <td>
                      {canDirectlyEditCandidateField(activeProfile, candidate, "owner_id") ? (
                        <select
                          value={candidate.owner_id || ""}
                          onChange={(event) =>
                            onUpdateCandidate(candidate.id, "owner_id", event.target.value || null)
                          }
                          className="sheet-input"
                          aria-label="Recruiter owner"
                        >
                          <option value="">Unassigned</option>
                          {profiles.map((profile) => (
                            <option key={profile.id} value={profile.id}>
                              {profile.full_name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="px-3 py-2.5 text-sm font-semibold text-secondary">
                          {getRecruiterName(profiles, candidate.owner_id)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <DocsPill
                        value={candidate.docs_status}
                        disabled={!canDirectlyEditCandidateField(activeProfile, candidate, "docs_status")}
                        onChange={(value) => onUpdateCandidate(candidate.id, "docs_status", value)}
                      />
                    </td>
                    <td>{renderTextInput(candidate, "fee", "sheet-number")}</td>
                    <td>{renderTextInput(candidate, "next_follow_up", stale ? "font-bold text-amber-700 dark:text-amber-300" : "sheet-date")}</td>
                    <td>{renderTextInput(candidate, "last_contact", "sheet-date")}</td>
                    <td>{renderTextInput(candidate, "notes")}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenEmailDraft(candidate)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-app bg-surface text-secondary transition hover:bg-raised hover:text-primary"
                          aria-label={`Draft email for ${candidate.name || "candidate"}`}
                        >
                          <Mail size={15} />
                        </button>

                        {!archivedMode && canRequestCandidateChange(activeProfile, candidate, "phone") ? (
                          <button
                            type="button"
                            onClick={() => onRequestCorrection(candidate)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-app bg-surface text-secondary transition hover:bg-raised hover:text-teal-700"
                            aria-label={`Request correction for ${candidate.name || "candidate"}`}
                          >
                            <ShieldAlert size={15} />
                          </button>
                        ) : null}

                        {!archivedMode && canArchiveCandidate(activeProfile, candidate) ? (
                          <button
                            type="button"
                            onClick={() => onArchiveCandidate(candidate)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                            aria-label={`Archive ${candidate.name || "candidate"}`}
                          >
                            <Archive size={15} />
                          </button>
                        ) : null}

                        {archivedMode && canRestoreCandidate(activeProfile) ? (
                          <button
                            type="button"
                            onClick={() => onRestoreCandidate(candidate)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                            aria-label={`Restore ${candidate.name || "candidate"}`}
                          >
                            <Undo2 size={15} />
                          </button>
                        ) : null}

                        {canPermanentlyDeleteCandidate(activeProfile, candidate) ? (
                          <button
                            type="button"
                            onClick={() => onDeleteCandidate(candidate)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
                            aria-label={`Permanently delete ${candidate.name || "candidate"}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        ) : null}

                        {firstWarning ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onLinkDuplicate(candidate, firstWarning)}
                              className="h-8 rounded-lg border border-app bg-surface px-2 text-xs font-bold text-secondary hover:bg-raised hover:text-primary"
                            >
                              Link
                            </button>
                            <button
                              type="button"
                              onClick={() => onDismissDuplicate(candidate, firstWarning)}
                              className="h-8 rounded-lg px-2 text-xs font-bold text-secondary hover:bg-raised hover:text-primary"
                            >
                              Dismiss
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <span className="sr-only">{allCandidates.length} total candidates loaded.</span>
    </div>
  );
}
