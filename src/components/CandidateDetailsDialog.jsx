import { useMemo, useState } from "react";
import { DOC_STATUSES, PIPELINE_STAGES } from "../constants/pipeline";
import { formatCurrency, formatExperience, formatLpa, getRecruiterName } from "../utils/candidateUtils";
import {
  canDirectlyEditCandidateField,
  canRequestCandidateChange,
  isAdmin,
} from "../utils/permissions";
import Modal from "./Modal";
import { DOCUMENT_CHECKLIST_FIELDS, deriveDocumentStatus, getDocumentProgress, normalizeChecklist } from "../utils/documentChecklist";
import { formatScorecardAverage } from "../utils/interviewScorecard";

const numberFields = new Set([
  "experience_years",
  "relevant_experience",
  "current_ctc",
  "expected_ctc",
  "fee",
  "notice_period_days",
  "offered_ctc",
  "final_ctc",
  "retention_period_days",
]);
const dateFields = new Set(["last_working_date", "next_follow_up", "last_contact", "offer_date", "offer_accepted_date", "resignation_date", "expected_joining_date", "actual_joining_date", "retention_start_date", "retention_due_date", "replacement_guarantee_end_date", "invoice_eligibility_date"]);
const nullableSelectFields = new Set(["vacancy_id", "owner_id"]);

const sections = [
  {
    title: "Basic information",
    fields: [
      ["name", "Candidate name", "text"],
      ["phone", "Phone", "tel"],
      ["email", "Email", "email"],
      ["current_employer", "Current employer", "text"],
      ["experience_years", "Total experience", "number"],
      ["relevant_experience", "Relevant experience", "number"],
      ["role", "Current role or designation", "text"],
      ["grade", "Grade or designation", "text"],
      ["current_location", "Current location", "text"],
      ["preferred_location", "Preferred location", "text"],
    ],
  },
  {
    title: "Opportunity",
    fields: [
      ["vacancy_id", "Vacancy", "vacancy"],
      ["target_bank", "Target bank or client", "text"],
      ["stage", "Stage", "stage"],
      ["owner_id", "Recruiter or owner", "owner"],
      ["source", "Source", "text"],
      ["past_client_association", "Past association with client", "checkbox"],
      ["offer_status", "Offer status", "offer"],
    ],
  },
  {
    title: "Compensation and availability",
    fields: [
      ["current_ctc", "Current CTC", "number"],
      ["expected_ctc", "Expected CTC", "number"],
      ["offered_ctc", "Offered CTC", "number"],
      ["final_ctc", "Final CTC", "number"],
      ["fee", "Placement fee", "number"],
      ["notice_period_days", "Notice period in days", "number"],
      ["last_working_date", "Last working date", "date"],
      ["offer_date", "Offer date", "date"],
      ["offer_accepted_date", "Offer accepted date", "date"],
      ["resignation_date", "Resignation date", "date"],
      ["expected_joining_date", "Expected joining date", "date"],
      ["actual_joining_date", "Actual joining date", "date"],
      ["joining_risk", "Joining risk", "joining-risk"],
      ["joining_notes", "Joining notes", "text"],
      ["retention_period_days", "Retention period (days)", "number"],
      ["retention_start_date", "Retention start date", "date"],
      ["retention_due_date", "Retention due date", "date"],
      ["retention_status", "Retention status", "retention"],
      ["replacement_guarantee_end_date", "Replacement guarantee end date", "date"],
      ["invoice_eligibility_date", "Invoice eligibility date", "date"],
    ],
  },
  {
    title: "Documents and notes",
    fields: [
      ["next_follow_up", "Next follow-up", "date"],
      ["last_contact", "Last contact", "date"],
      ["docs_status", "Documents status", "docs"],
      ["document_checklist", "Document checklist", "checklist"],
      ["notes", "Notes", "textarea"],
    ],
  },
];

function normalizeInitialValue(candidate, field) {
  const value = candidate?.[field];
  if (value === null || value === undefined) return field === "past_client_association" ? false : field === "document_checklist" ? {} : "";
  if (dateFields.has(field)) return String(value).slice(0, 10);
  return value;
}

function normalizeForSave(field, value) {
  if (field === "past_client_association") return Boolean(value);
  if (field === "document_checklist") return normalizeChecklist(value);
  if (numberFields.has(field)) return value === "" ? null : Number(value);
  if (dateFields.has(field) || nullableSelectFields.has(field)) return value === "" ? null : value;
  return value === "" ? null : value;
}

function displayValue(candidate, field, profiles, vacancies) {
  const value = candidate?.[field];
  if (field === "vacancy_id") {
    const vacancy = vacancies.find((item) => item.id === value);
    return vacancy ? `${vacancy.client_name} - ${vacancy.job_title}` : "-";
  }
  if (field === "owner_id") return getRecruiterName(profiles, value);
  if (field === "past_client_association") return value ? "Yes" : "No";
  if (field === "docs_status" && candidate?.document_checklist) return deriveDocumentStatus(candidate.document_checklist);
  if (field === "experience_years" || field === "relevant_experience") return formatExperience(value);
  if (field === "current_ctc" || field === "expected_ctc") return formatLpa(value);
  if (field === "offered_ctc" || field === "final_ctc") return formatLpa(value);
  if (field === "document_checklist") { const progress = getDocumentProgress(value); return `${progress.complete} of ${progress.total} complete`; }
  if (field === "fee") return formatCurrency(value);
  if (dateFields.has(field)) return value ? String(value).slice(0, 10) : "-";
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function CandidateDetailsDialog({
  candidate,
  vacancies,
  profiles = [],
  activeProfile,
  duplicateWarnings = [],
  mode = "view",
  onSave,
  onScheduleInterview,
  activities = [],
  interviews = [],
  onClose,
}) {
  const editableMode = mode === "edit";
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [formValues, setFormValues] = useState(() => {
    const values = {};
    sections.forEach((section) => {
      section.fields.forEach(([field]) => {
        values[field] = normalizeInitialValue(candidate, field);
      });
    });
    return values;
  });

  const duplicateStatus = useMemo(() => {
    if (!duplicateWarnings.length) return "Clear";
    return duplicateWarnings[0].isArchived ? "Previous candidate" : "Possible duplicate";
  }, [duplicateWarnings]);

  const canEdit = (field) => editableMode && canDirectlyEditCandidateField(activeProfile, candidate, field);
  const canRequest = (field) => editableMode && canRequestCandidateChange(activeProfile, candidate, field);

  const updateField = (field, value) => {
    setFormValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  };

  const validate = () => {
    const nextErrors = {};
    if (canEdit("name") && !String(formValues.name || "").trim()) {
      nextErrors.name = "Candidate name is required.";
    }
    if (formValues.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(formValues.email))) {
      nextErrors.email = "Enter a valid email address.";
    }
    numberFields.forEach((field) => {
      if (formValues[field] !== "" && Number(formValues[field]) < 0) {
        nextErrors[field] = "Enter zero or a positive number.";
      }
    });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const save = async (event) => {
    event.preventDefault();
    if (!editableMode || saving || !validate()) return;

    const updates = {};
    sections.forEach((section) => {
      section.fields.forEach(([field]) => {
        if (!canEdit(field)) return;
        const nextValue = normalizeForSave(field, formValues[field]);
        const previousValue = normalizeForSave(field, normalizeInitialValue(candidate, field));
        if (nextValue !== previousValue) updates[field] = nextValue;
      });
    });

    if (Object.keys(updates).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const saved = await onSave(updates);
      if (saved !== false) onClose();
      else setErrors((current) => ({ ...current, form: "Could not save changes. Please try again." }));
    } finally {
      setSaving(false);
    }
  };

  const renderEditor = (field, label, type) => {
    if (!editableMode) {
      return (
        <div className={type === "textarea" ? "md:col-span-2" : ""}>
          <p className="text-xs font-semibold uppercase text-secondary">{label}</p>
          <p className="mt-1 min-h-9 whitespace-pre-wrap rounded-lg border border-app bg-surface px-3 py-2 text-sm text-primary">
            {displayValue(candidate, field, profiles, vacancies)}
          </p>
        </div>
      );
    }

    const allowed = canEdit(field);
    const commonClass =
      "mt-1 w-full rounded-lg border border-app bg-raised px-3 py-2.5 text-sm text-primary outline-none focus:ring-2 focus:ring-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-60";

    let control;
    if (type === "textarea") {
      control = (
        <textarea
          value={formValues[field] || ""}
          onChange={(event) => updateField(field, event.target.value)}
          disabled={!allowed}
          rows={4}
          className={`${commonClass} resize-y`}
        />
      );
    } else if (type === "checkbox") {
      control = (
        <label className="mt-2 flex items-center gap-2 text-sm text-primary">
          <input
            type="checkbox"
            checked={Boolean(formValues[field])}
            onChange={(event) => updateField(field, event.target.checked)}
            disabled={!allowed}
          />
          Past association recorded
        </label>
      );
    } else if (type === "vacancy") {
      control = (
        <select value={formValues[field] || ""} onChange={(event) => updateField(field, event.target.value)} disabled={!allowed} className={commonClass}>
          <option value="">No vacancy linked</option>
          {vacancies.map((vacancy) => (
            <option key={vacancy.id} value={vacancy.id}>
              {vacancy.client_name} - {vacancy.job_title}
            </option>
          ))}
        </select>
      );
    } else if (type === "stage") {
      control = (
        <select value={formValues[field] || ""} onChange={(event) => updateField(field, event.target.value)} disabled={!allowed} className={commonClass}>
          {PIPELINE_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {stage}
            </option>
          ))}
        </select>
      );
    } else if (type === "owner") {
      control = (
        <select value={formValues[field] || ""} onChange={(event) => updateField(field, event.target.value)} disabled={!allowed} className={commonClass}>
          <option value="">Unassigned</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.full_name}
            </option>
          ))}
        </select>
      );
    } else if (type === "docs") {
      control = (
        <select value={formValues[field] || ""} onChange={(event) => updateField(field, event.target.value)} disabled={!allowed} className={commonClass}>
          {DOC_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      );
    } else if (type === "offer") {
      control = <select value={formValues[field] || "Not Started"} onChange={(event) => updateField(field, event.target.value)} disabled={!allowed} className={commonClass}>{["Not Started", "In Discussion", "Offered", "Accepted", "Declined", "Withdrawn"].map((value) => <option key={value}>{value}</option>)}</select>;
    } else if (type === "joining-risk") {
      control = <select value={formValues[field] || "Low"} onChange={(event) => updateField(field, event.target.value)} disabled={!allowed} className={commonClass}>{["Low", "Medium", "High"].map((value) => <option key={value}>{value}</option>)}</select>;
    } else if (type === "retention") {
      control = <select value={formValues[field] || "Not Started"} onChange={(event) => updateField(field, event.target.value)} disabled={!allowed} className={commonClass}>{["Not Started", "In Progress", "Completed", "Failed", "Replacement Required"].map((value) => <option key={value}>{value}</option>)}</select>;
    } else if (type === "checklist") {
      const checklist = normalizeChecklist(formValues[field]);
      control = <div className="mt-2 grid gap-2 rounded-lg border border-app bg-surface p-3 sm:grid-cols-2">{DOCUMENT_CHECKLIST_FIELDS.map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm text-primary"><input type="checkbox" checked={Boolean(checklist[key])} onChange={(event) => updateField(field, { ...checklist, [key]: event.target.checked })} disabled={!allowed} />{label}</label>)}</div>;
    } else {
      control = (
        <input
          type={type}
          min={numberFields.has(field) ? "0" : undefined}
          step={field === "experience_years" || field === "relevant_experience" ? "0.5" : undefined}
          value={formValues[field] || ""}
          onChange={(event) => updateField(field, event.target.value)}
          disabled={!allowed}
          className={commonClass}
        />
      );
    }

    return (
      <label className={type === "textarea" ? "md:col-span-2" : ""}>
        <span className="text-sm font-medium text-secondary">{label}</span>
        {control}
        {errors[field] ? <span className="mt-1 block text-xs font-semibold text-rose-600">{errors[field]}</span> : null}
        {!allowed && canRequest(field) ? (
          <span className="mt-1 block text-xs text-secondary">Use the correction workflow for this protected field.</span>
        ) : null}
      </label>
    );
  };

  return (
    <Modal
      title={editableMode ? "Edit candidate profile" : "Candidate profile"}
      description={editableMode ? "Update the candidate record using the permitted fields for your role." : "View the complete candidate record."}
      onClose={onClose}
      busy={saving}
      size="max-w-5xl"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="action-button border border-app bg-surface text-secondary hover:bg-raised" disabled={saving} onClick={onClose}>
            {editableMode ? "Cancel" : "Close"}
          </button>
          {editableMode ? (
            <button form="candidate-profile-form" className="action-button action-primary" disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          ) : !candidate.is_archived ? <button type="button" className="action-button action-primary" onClick={() => onScheduleInterview?.(candidate)}>Schedule interview</button> : null}
        </div>
      }
    >
      <form id="candidate-profile-form" onSubmit={save} className="space-y-5">
        {errors.form ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{errors.form}</p> : null}
        {sections.map((section) => (
          <section key={section.title} className="rounded-lg border border-app bg-surface p-4">
            <h3 className="text-sm font-semibold text-primary">{section.title}</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {section.fields.map(([field, label, type]) => (
                <div key={field} className={type === "textarea" ? "md:col-span-2" : ""}>
                  {renderEditor(field, label, type)}
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="rounded-lg border border-app bg-surface p-4">
          <h3 className="text-sm font-semibold text-primary">Interview and follow-up</h3>
          {interviews.length ? <div className="mt-4 space-y-3">{interviews.slice(0, 4).map((interview) => <div key={interview.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-app bg-raised px-3 py-2"><div><p className="text-sm font-semibold text-primary">{interview.round_type || "Interview"} · {interview.interview_status || "Scheduled"}</p><p className="text-xs text-secondary">{interview.panel_name || "Panel pending"} · {interview.feedback_status || "Not Due"}</p></div><span className="text-xs font-semibold text-secondary">{formatScorecardAverage(interview)}</span></div>)}</div> : <p className="mt-3 text-sm text-secondary">No interviews recorded for this candidate.</p>}
        </section>

        <section className="rounded-lg border border-app bg-surface p-4">
          <h3 className="text-sm font-semibold text-primary">Activity timeline</h3>
          {activities.length ? <ol className="mt-4 space-y-3">{activities.slice(0, 12).map((activity) => <li key={activity.id} className="flex gap-3"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" /><div className="min-w-0"><p className="text-sm font-semibold text-primary">{activity.summary}</p><p className="text-xs text-secondary">{activity.detail || activity.actor_name} · {formatDateTime(activity.created_at)}</p></div></li>)}</ol> : <p className="mt-3 text-sm text-secondary">No recorded activity yet.</p>}
        </section>

        <section className="rounded-lg border border-app bg-surface p-4">
          <h3 className="text-sm font-semibold text-primary">System information</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-secondary">Created date</p>
              <p className="mt-1 text-sm text-primary">{formatDateTime(candidate.created_at)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-secondary">Updated date</p>
              <p className="mt-1 text-sm text-primary">{formatDateTime(candidate.updated_at)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-secondary">Sample-data status</p>
              <p className="mt-1 text-sm text-primary">{candidate.is_demo ? "Sample record" : "Real record"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-secondary">Match or duplicate status</p>
              <p className="mt-1 text-sm text-primary">{duplicateStatus}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-secondary">Permission mode</p>
              <p className="mt-1 text-sm text-primary">{isAdmin(activeProfile) ? "Admin" : "Recruiter"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-secondary">Archived state</p>
              <p className="mt-1 text-sm text-primary">{candidate.is_archived ? "Archived" : "Active"}</p>
            </div>
          </div>
        </section>
      </form>
    </Modal>
  );
}
