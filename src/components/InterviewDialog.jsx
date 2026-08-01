import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import { FEEDBACK_STATUSES, INTERVIEW_MODES, INTERVIEW_ROUNDS, RECOMMENDATIONS } from "../utils/interviews";
import { SCORECARD_FIELDS } from "../utils/interviewScorecard";

const toDate = (value) => value ? String(value).slice(0, 10) : "";
const toTime = (value) => value ? (String(value).includes("T") ? String(value).split("T")[1].slice(0, 5) : String(value).slice(0, 5)) : "";

export default function InterviewDialog({ mode = "schedule", interview, candidates, vacancies, profiles, activeProfile, onClose, onSave, saving = false }) {
  const initial = useMemo(() => ({
    candidate_id: interview?.candidate_id || candidates[0]?.id || "",
    vacancy_id: interview?.vacancy_id || "",
    round_type: interview?.round_type || "TP1",
    round_number: interview?.round_number || 1,
    scheduled_date: toDate(interview?.scheduled_date || interview?.scheduled_at),
    scheduled_time: toTime(interview?.scheduled_time || interview?.scheduled_at),
    timezone: interview?.timezone || "Asia/Kolkata",
    mode: interview?.mode || "Video",
    meeting_link: interview?.meeting_link || "",
    venue: interview?.venue || "",
    panel_name: interview?.panel_name || "",
    panel_email: interview?.panel_email || "",
    candidate_confirmation_status: interview?.candidate_confirmation_status || "Pending",
    internal_notes: interview?.internal_notes || "",
    feedback_status: interview?.feedback_status || "Pending",
    recommendation: interview?.recommendation || "No Decision",
    feedback_summary: interview?.feedback_summary || "",
    rejection_reason: interview?.rejection_reason || "",
    technical_fit_score: interview?.technical_fit_score || "",
    communication_score: interview?.communication_score || "",
    role_fit_score: interview?.role_fit_score || "",
    stability_motivation_score: interview?.stability_motivation_score || "",
  }), [candidates, interview]);
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  useEffect(() => setForm(initial), [initial]);
  const selectedCandidate = candidates.find((candidate) => candidate.id === form.candidate_id);
  const selectedVacancy = vacancies.find((vacancy) => vacancy.id === form.vacancy_id);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.candidate_id || !form.scheduled_date || !form.scheduled_time) { setError("Candidate, date and time are required."); return; }
    if (mode !== "feedback" && new Date(`${form.scheduled_date}T${form.scheduled_time}`).getTime() < Date.now() && activeProfile?.role !== "admin") { setError("Choose a future date and time."); return; }
    if (form.mode === "Video" && !form.meeting_link) { setError("Add a meeting link for video interviews."); return; }
    if (form.mode === "In Person" && !form.venue) { setError("Add a venue for in-person interviews."); return; }
    if (mode === "feedback" && form.recommendation === "Reject" && !form.rejection_reason.trim()) { setError("Add a rejection reason."); return; }
    await onSave({ ...form, candidate: selectedCandidate, vacancy: selectedVacancy });
  };
  const title = mode === "feedback" ? `Record feedback${selectedCandidate ? ` · ${selectedCandidate.name}` : ""}` : mode === "reschedule" ? "Reschedule interview" : interview ? "Edit interview" : "Schedule interview";
  return <Modal title={title} description={mode === "feedback" ? "Capture the outcome without changing the candidate stage automatically." : "Keep the schedule, panel and confirmation state together."} onClose={onClose} busy={saving} size="max-w-3xl" footer={<div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={onClose} className="action-button border border-app bg-surface text-secondary hover:bg-raised">Cancel</button><button type="submit" form="interview-form" disabled={saving} className="action-button action-primary">{saving ? "Saving…" : mode === "feedback" ? "Save feedback" : mode === "reschedule" ? "Create replacement" : "Save interview"}</button></div>}>
    <form id="interview-form" onSubmit={submit} className="space-y-5">
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">{error}</div> : null}
      {mode === "feedback" ? <div className="grid gap-4 md:grid-cols-2"><Field label="Feedback status"><select value={form.feedback_status} onChange={(event) => update("feedback_status", event.target.value)}>{FEEDBACK_STATUSES.map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Recommendation"><select value={form.recommendation} onChange={(event) => update("recommendation", event.target.value)}>{RECOMMENDATIONS.map((value) => <option key={value}>{value}</option>)}</select></Field><div className="md:col-span-2 rounded-lg border border-app bg-raised p-3"><p className="text-sm font-semibold text-primary">Interview scorecard</p><p className="mt-1 text-xs text-secondary">Use a consistent 1–5 score for the panel discussion.</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{SCORECARD_FIELDS.map(([field, label]) => <Field key={field} label={label}><select value={form[field]} onChange={(event) => update(field, event.target.value)}><option value="">Not scored</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></Field>)}</div></div><Field label="Feedback summary" wide><textarea value={form.feedback_summary} onChange={(event) => update("feedback_summary", event.target.value)} rows={5} placeholder="What did the panel share?" /></Field><Field label="Rejection reason" wide><textarea value={form.rejection_reason} onChange={(event) => update("rejection_reason", event.target.value)} rows={3} placeholder="Required when rejecting" /></Field></div> : <div className="grid gap-4 md:grid-cols-2"><Field label="Candidate"><select value={form.candidate_id} onChange={(event) => update("candidate_id", event.target.value)}>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></Field><Field label="Vacancy"><select value={form.vacancy_id} onChange={(event) => update("vacancy_id", event.target.value)}><option value="">No linked vacancy</option>{vacancies.map((vacancy) => <option key={vacancy.id} value={vacancy.id}>{vacancy.client_name} · {vacancy.job_title}</option>)}</select></Field><Field label="Round"><select value={form.round_type} onChange={(event) => update("round_type", event.target.value)}>{INTERVIEW_ROUNDS.map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Round number"><input type="number" min="1" value={form.round_number} onChange={(event) => update("round_number", event.target.value)} /></Field><Field label="Date"><input type="date" value={form.scheduled_date} onChange={(event) => update("scheduled_date", event.target.value)} /></Field><Field label="Time"><input type="time" value={form.scheduled_time} onChange={(event) => update("scheduled_time", event.target.value)} /></Field><Field label="Time zone"><input value={form.timezone} onChange={(event) => update("timezone", event.target.value)} /></Field><Field label="Mode"><select value={form.mode} onChange={(event) => update("mode", event.target.value)}>{INTERVIEW_MODES.map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Meeting link"><input value={form.meeting_link} onChange={(event) => update("meeting_link", event.target.value)} placeholder="https://…" /></Field><Field label="Venue"><input value={form.venue} onChange={(event) => update("venue", event.target.value)} /></Field><Field label="Panel name"><input value={form.panel_name} onChange={(event) => update("panel_name", event.target.value)} /></Field><Field label="Panel email"><input type="email" value={form.panel_email} onChange={(event) => update("panel_email", event.target.value)} /></Field><Field label="Candidate confirmation"><select value={form.candidate_confirmation_status} onChange={(event) => update("candidate_confirmation_status", event.target.value)}>{["Pending", "Confirmed", "Requested Reschedule", "Declined", "No Response"].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Internal notes" wide><textarea value={form.internal_notes} onChange={(event) => update("internal_notes", event.target.value)} rows={3} /></Field></div>}
    </form>
  </Modal>;
}

function Field({ label, children, wide = false }) { return <label className={`block text-sm font-medium text-secondary ${wide ? "md:col-span-2" : ""}`}>{label}{<span className="mt-1 block [&>input]:h-10 [&>input]:w-full [&>input]:rounded-lg [&>input]:border [&>input]:border-app [&>input]:bg-raised [&>input]:px-3 [&>input]:text-sm [&>input]:text-primary [&>input]:outline-none [&>select]:h-10 [&>select]:w-full [&>select]:rounded-lg [&>select]:border [&>select]:border-app [&>select]:bg-raised [&>select]:px-3 [&>select]:text-sm [&>select]:text-primary [&>select]:outline-none [&>textarea]:w-full [&>textarea]:rounded-lg [&>textarea]:border [&>textarea]:border-app [&>textarea]:bg-raised [&>textarea]:px-3 [&>textarea]:py-2 [&>textarea]:text-sm [&>textarea]:text-primary [&>textarea]:outline-none">{children}</span>}</label>; }
