import {
  Archive,
  AlertTriangle,
  Edit3,
  Eye,
  Link2,
  Mail,
  ShieldAlert,
  Trash2,
  Undo2,
  XCircle,
} from "lucide-react";
import DocsPill from "./DocsPill";
import RowActionMenu from "./RowActionMenu";
import StagePill from "./StagePill";
import {
  formatCurrency,
  formatLpa,
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
import { getDocumentProgress } from "../utils/documentChecklist";

const STICKY_ACTION_WIDTH = 116;

const pipelineColumns = [
  { label: "Actions", key: "actions", width: "w-[116px] min-w-[116px]", sticky: "actions" },
  { label: "Candidate", key: "name", width: "w-[260px] min-w-[260px]", sticky: "candidate" },
  { label: "Match", key: "match", width: "min-w-40" },
  { label: "Phone", key: "phone", width: "min-w-36" },
  { label: "Current Employer", key: "current_employer", width: "min-w-48" },
  { label: "Experience", key: "experience_years", width: "min-w-32" },
  { label: "Target Bank", key: "target_bank", width: "min-w-48" },
  { label: "Role", key: "role", width: "min-w-48" },
  { label: "Stage", key: "stage", width: "min-w-40" },
  { label: "Actual Joining Date", key: "actual_joining_date", width: "min-w-44" },
  { label: "Recruiter", key: "owner_id", width: "min-w-44" },
  { label: "Documents", key: "docs_status", width: "min-w-36" },
  { label: "Fee", key: "fee", width: "min-w-32" },
  { label: "Next Follow-up", key: "next_follow_up", width: "min-w-40" },
  { label: "Last Contact", key: "last_contact", width: "min-w-40" },
  { label: "Notes", key: "notes", width: "min-w-64 max-w-72" },
  { label: "Email", key: "email", width: "min-w-56" },
  { label: "Vacancy", key: "vacancy_id", width: "min-w-48" },
  { label: "Current CTC", key: "current_ctc", width: "min-w-32" },
  { label: "Expected CTC", key: "expected_ctc", width: "min-w-32" },
  { label: "Current Location", key: "current_location", width: "min-w-40" },
];

const archivedColumns = [
  { label: "Actions", key: "actions", width: "w-[116px] min-w-[116px]", sticky: "actions" },
  { label: "Candidate", key: "name", width: "w-[260px] min-w-[260px]", sticky: "candidate" },
  { label: "Match", key: "match", width: "min-w-40" },
  { label: "Phone", key: "phone", width: "min-w-36" },
  { label: "Email", key: "email", width: "min-w-56" },
  { label: "Current Employer", key: "current_employer", width: "min-w-48" },
  { label: "Vacancy", key: "vacancy_id", width: "min-w-48" },
  { label: "Current CTC", key: "current_ctc", width: "min-w-32" },
  { label: "Expected CTC", key: "expected_ctc", width: "min-w-32" },
  { label: "Current Location", key: "current_location", width: "min-w-40" },
  { label: "Experience", key: "experience_years", width: "min-w-32" },
  { label: "Target Bank", key: "target_bank", width: "min-w-48" },
  { label: "Role", key: "role", width: "min-w-48" },
  { label: "Stage", key: "stage", width: "min-w-40" },
  { label: "Actual Joining Date", key: "actual_joining_date", width: "min-w-44" },
  { label: "Recruiter", key: "owner_id", width: "min-w-44" },
  { label: "Documents", key: "docs_status", width: "min-w-36" },
  { label: "Fee", key: "fee", width: "min-w-32" },
  { label: "Next Follow-up", key: "next_follow_up", width: "min-w-40" },
  { label: "Last Contact", key: "last_contact", width: "min-w-40" },
  { label: "Notes", key: "notes", width: "min-w-64 max-w-72" },
];

const typeByField = {
  email: "email",
  experience_years: "number",
  fee: "number",
  current_ctc: "number",
  expected_ctc: "number",
  next_follow_up: "date",
  last_contact: "date",
  actual_joining_date: "date",
};

const moneyFields = new Set(["fee", "current_ctc", "expected_ctc"]);
const numberFields = new Set(["fee", "experience_years", "current_ctc", "expected_ctc"]);

function stickyClass(column) {
  if (column.sticky === "actions") {
    return "sticky left-0 z-20 bg-surface shadow-[8px_0_14px_-16px_rgb(15_23_42_/_0.45)]";
  }
  if (column.sticky === "candidate") {
    return "sticky z-20 bg-surface shadow-[10px_0_16px_-16px_rgb(15_23_42_/_0.5)]";
  }
  return "";
}

function stickyStyle(column) {
  if (column.sticky === "candidate") return { left: "var(--actions-column-width)" };
  return undefined;
}

function textValue(candidate, field) {
  const value = candidate[field];
  if (field === "experience_years") return formatExperience(value);
  if (field === "current_ctc" || field === "expected_ctc") return formatLpa(value);
  if (moneyFields.has(field)) return formatCurrency(value);
  return value || "-";
}

function MatchBadge({ candidate, warning, onOpenDuplicate }) {
  if (!warning) {
    return (
      <span className="inline-flex rounded-full border border-app bg-raised px-2 py-1 text-[11px] font-semibold text-secondary">
        Clear
      </span>
    );
  }

  const label = warning.isArchived ? "Previous candidate" : "Possible duplicate";
  const status = warning.isArchived ? "Archived" : "Active";

  return (
    <div className="group relative inline-flex">
      <button
        type="button"
        onClick={() => onOpenDuplicate(candidate, warning)}
        className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 transition hover:border-amber-300 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
      >
        {label}
      </button>
      <div className="glass-panel pointer-events-none absolute left-0 top-8 z-50 hidden w-72 rounded-lg border p-3 text-xs normal-case text-primary opacity-0 shadow-lg transition group-hover:block group-hover:opacity-100">
        <p className="font-semibold">{warning.candidate?.name || "Matched candidate"}</p>
        <dl className="mt-2 grid grid-cols-[88px_1fr] gap-x-2 gap-y-1 text-secondary">
          <dt>Reason</dt>
          <dd className="font-medium text-primary">{warning.matchType || "Potential match"}</dd>
          <dt>Stage</dt>
          <dd>{warning.candidate?.stage || "-"}</dd>
          <dt>Status</dt>
          <dd>{status}</dd>
          <dt>Action</dt>
          <dd>{warning.isArchived ? "Open, restore, link or dismiss" : "Open, link or dismiss"}</dd>
        </dl>
      </div>
    </div>
  );
}

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
  onOpenDetails,
  onEditCandidate,
  emptyMessage = "No candidates match the current filters.",
  archivedMode = false,
  vacancies = [],
  fillHeight = false,
}) {
  const columns = archivedMode ? archivedColumns : pipelineColumns;
  const tableWidth = archivedMode ? "min-w-[2620px]" : "min-w-[2740px]";

  const renderTextInput = (candidate, field, extraClass = "") => {
    const canEdit = canDirectlyEditCandidateField(activeProfile, candidate, field);
    const canRequest = canRequestCandidateChange(activeProfile, candidate, field);
    const value = candidate[field] ?? "";
    const needsActualJoiningDate =
      field === "actual_joining_date" && candidate.stage === "Joined" && !value;
    const displayValue = needsActualJoiningDate ? "dd/mm/yyyy" : textValue(candidate, field);
    const inputClass = `${extraClass} ${
      needsActualJoiningDate
        ? "bg-amber-50/70 font-semibold text-amber-700 placeholder:text-amber-700 dark:bg-amber-950/20 dark:text-amber-300 dark:placeholder:text-amber-300"
        : ""
    }`;

    if (!canEdit) {
      return (
        <div className="flex min-h-9 items-center gap-2 px-3 py-1.5 text-sm text-primary">
          <span
            className={`truncate ${needsActualJoiningDate ? "font-semibold text-amber-700 dark:text-amber-300" : ""}`}
            title={displayValue}
          >
            {displayValue}
          </span>
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
        min={numberFields.has(field) ? "0" : undefined}
        step={field === "experience_years" ? "0.5" : undefined}
        value={value}
        title={needsActualJoiningDate ? "dd/mm/yyyy" : String(value || "")}
        placeholder={typeByField[field] === "date" ? "dd/mm/yyyy" : undefined}
        aria-label={field === "actual_joining_date" ? "Actual joining date" : undefined}
        onChange={(event) => {
          const raw = event.target.value;
          const nextValue = numberFields.has(field) ? (raw === "" ? "" : Number(raw)) : raw;
          onUpdateCandidate(candidate.id, field, nextValue);
        }}
        className={`sheet-input ${inputClass}`}
      />
    );
  };

  const renderNotes = (candidate) => {
    const canEdit = canDirectlyEditCandidateField(activeProfile, candidate, "notes");
    const value = candidate.notes || "";

    if (canEdit) {
      return (
        <input
          type="text"
          value={value}
          title={value}
          onChange={(event) => onUpdateCandidate(candidate.id, "notes", event.target.value)}
          className="sheet-input max-w-72"
        />
      );
    }

    return (
      <div className="px-3 py-2 text-sm text-primary" title={value || "No notes"}>
        <p className="line-clamp-2 max-w-72 leading-5">{value || "-"}</p>
      </div>
    );
  };

  const renderCandidateCell = (candidate) => {
    const stale = isCandidateStale(candidate);
    const secondary = [candidate.current_employer, candidate.role].filter(Boolean).join(" · ");

    return (
      <div className="px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {stale ? (
            <AlertTriangle
              size={14}
              strokeWidth={2.2}
              className="shrink-0 text-amber-600"
              aria-label="Overdue follow-up"
            />
          ) : null}
          <span className="min-w-0 truncate text-sm font-semibold text-primary" title={candidate.name || "Unnamed candidate"}>
            {candidate.name || "Unnamed candidate"}
          </span>
          {candidate.is_demo ? (
            <span className="shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:bg-sky-950 dark:text-sky-200">
              Sample
            </span>
          ) : null}
        </div>
        {secondary ? (
          <p className="mt-0.5 truncate text-xs text-secondary" title={secondary}>
            {secondary}
          </p>
        ) : null}
      </div>
    );
  };

  const renderActionCell = (candidate, firstWarning) => {
    const canEditDetails = canDirectlyEditCandidateField(activeProfile, candidate, "notes");
    const canArchive = !archivedMode && canArchiveCandidate(activeProfile, candidate);
    const canRestore = archivedMode && canRestoreCandidate(activeProfile);
    const canDelete = canPermanentlyDeleteCandidate(activeProfile, candidate);
    const canRequest = !archivedMode && canRequestCandidateChange(activeProfile, candidate, "phone");
    const moreItems = [
      onOpenEmailDraft
        ? { label: "Draft email", icon: <Mail size={14} />, onSelect: () => onOpenEmailDraft(candidate) }
        : null,
      canRequest
        ? { label: "Request correction", icon: <ShieldAlert size={14} />, onSelect: () => onRequestCorrection(candidate) }
        : null,
      firstWarning
        ? { label: "Link to existing", icon: <Link2 size={14} />, onSelect: () => onLinkDuplicate(candidate, firstWarning) }
        : null,
      firstWarning
        ? { label: "Dismiss match", icon: <XCircle size={14} />, onSelect: () => onDismissDuplicate(candidate, firstWarning) }
        : null,
      canArchive
        ? { label: "Archive", icon: <Archive size={14} />, onSelect: () => onArchiveCandidate(candidate) }
        : null,
      canDelete
        ? { label: "Permanent delete", icon: <Trash2 size={14} />, onSelect: () => onDeleteCandidate(candidate), destructive: true }
        : null,
    ];

    return (
      <div className="flex items-center gap-1.5 px-2 py-2">
        <button
          type="button"
          onClick={() => onOpenDetails?.(candidate)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-app bg-surface text-secondary transition hover:bg-raised hover:text-primary"
          aria-label={`Open details for ${candidate.name || "candidate"}`}
          title="Details"
        >
          <Eye size={15} />
        </button>
        {archivedMode ? (
          canRestore ? (
            <button
              type="button"
              onClick={() => onRestoreCandidate(candidate)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
              aria-label={`Restore ${candidate.name || "candidate"}`}
              title="Restore"
            >
              <Undo2 size={15} />
            </button>
          ) : null
        ) : canEditDetails ? (
          <button
            type="button"
            onClick={() => onEditCandidate?.(candidate)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-app bg-surface text-secondary transition hover:bg-raised hover:text-primary"
            aria-label={`Edit ${candidate.name || "candidate"}`}
            title="Edit"
          >
            <Edit3 size={15} />
          </button>
        ) : null}
        <RowActionMenu label={`More actions for ${candidate.name || "candidate"}`} items={moreItems} />
      </div>
    );
  };

  const renderCell = (candidate, column, firstWarning) => {
    switch (column.key) {
      case "actions":
        return renderActionCell(candidate, firstWarning);
      case "name":
        return renderCandidateCell(candidate);
      case "match":
        return (
          <div className="px-3 py-2">
            <MatchBadge candidate={candidate} warning={firstWarning} onOpenDuplicate={onOpenDuplicate} />
          </div>
        );
      case "vacancy_id":
        return <div className="truncate px-3 py-2 text-sm" title={vacancies.find((v) => v.id === candidate.vacancy_id)?.job_title || ""}>{vacancies.find((v) => v.id === candidate.vacancy_id)?.job_title || "-"}</div>;
      case "stage":
        return (
          <div className="px-3 py-2">
            <StagePill
              value={candidate.stage}
              disabled={!canDirectlyEditCandidateField(activeProfile, candidate, "stage")}
              onChange={(value) => onUpdateCandidate(candidate.id, "stage", value)}
            />
          </div>
        );
      case "owner_id":
        return canDirectlyEditCandidateField(activeProfile, candidate, "owner_id") ? (
          <select
            value={candidate.owner_id || ""}
            onChange={(event) => onUpdateCandidate(candidate.id, "owner_id", event.target.value || null)}
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
          <div className="truncate px-3 py-2 text-sm font-semibold text-secondary">
            {getRecruiterName(profiles, candidate.owner_id)}
          </div>
        );
      case "docs_status":
        return (
          <div className="px-3 py-2" title={candidate.document_checklist ? `${getDocumentProgress(candidate.document_checklist).complete} of ${getDocumentProgress(candidate.document_checklist).total} documents complete` : undefined}>
            <DocsPill
              value={candidate.docs_status}
              disabled={!canDirectlyEditCandidateField(activeProfile, candidate, "docs_status")}
              onChange={(value) => onUpdateCandidate(candidate.id, "docs_status", value)}
            />
          </div>
        );
      case "notes":
        return renderNotes(candidate);
      case "next_follow_up":
        return renderTextInput(candidate, "next_follow_up", isCandidateStale(candidate) ? "font-bold text-amber-700 dark:text-amber-300" : "sheet-date");
      case "last_contact":
        return renderTextInput(candidate, "last_contact", "sheet-date");
      case "actual_joining_date":
        return renderTextInput(candidate, "actual_joining_date", "sheet-date");
      case "experience_years":
        return renderTextInput(candidate, "experience_years", "text-center");
      case "target_bank":
        return renderTextInput(candidate, "target_bank", "font-semibold");
      case "fee":
      case "current_ctc":
      case "expected_ctc":
        return renderTextInput(candidate, column.key, "sheet-number");
      case "phone":
        return renderTextInput(candidate, "phone", "tabular-nums");
      default:
        return renderTextInput(candidate, column.key);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-app bg-surface">
      <div className={`${fillHeight && candidates.length ? "min-h-[220px]" : "max-h-[calc(100vh-330px)] min-h-[220px]"} overflow-auto`} style={{ "--actions-column-width": `${STICKY_ACTION_WIDTH}px`, "--candidate-column-width": "260px", ...(fillHeight && candidates.length ? { height: "max(220px, calc(100vh - 285px - var(--ask-command-bar-height) - var(--ask-command-bar-gap)))" } : {}) }}>
        <table className={`${tableWidth} w-full border-separate border-spacing-0 text-left`}>
          <thead className="glass-header sticky top-0 z-30 text-[11px] uppercase text-secondary">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`${column.width} ${stickyClass(column)} ${column.sticky ? "z-40" : ""} border-b border-app px-3 py-2.5 font-semibold tracking-wide`}
                  style={stickyStyle(column)}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-sm">
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
                const rowClass = stale
                  ? "bg-amber-50 dark:bg-amber-950/20"
                  : candidate.is_archived
                    ? "bg-zinc-50 text-secondary dark:bg-zinc-900/40"
                    : "bg-surface";

                return (
                  <tr
                    key={candidate.id}
                    className={`${rowClass} transition hover:bg-teal-50/40 dark:hover:bg-zinc-800/70`}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={`${column.width} ${stickyClass(column)} border-b border-app align-middle`}
                        style={stickyStyle(column)}
                      >
                        {renderCell(candidate, column, firstWarning)}
                      </td>
                    ))}
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
