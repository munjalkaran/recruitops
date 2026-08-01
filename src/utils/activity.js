export const activityLabel = (action) => ({
  created: "Candidate added",
  operations_updated: "Pipeline details updated",
  profile_extensions_updated: "Profile details updated",
  archived: "Candidate archived",
  restored: "Candidate restored",
  owner_assigned: "Recruiter assigned",
  change_request_approved: "Correction approved",
  candidate_linked: "Candidate records linked",
  duplicate_warning_dismissed: "Duplicate warning dismissed",
  email_draft_opened: "Email draft opened",
}[action] || String(action || "Candidate activity").replaceAll("_", " "));

export const buildCandidateActivity = (candidate, auditRows = [], interviews = [], activityRows = []) => {
  const audit = auditRows
    .filter((row) => row.candidate_id === candidate?.id)
    .map((row) => ({
      id: row.id,
      type: row.action,
      summary: activityLabel(row.action),
      detail: row.changed_fields && Object.keys(row.changed_fields).length ? "Record fields changed" : "",
      created_at: row.created_at,
      actor_name: row.actor_name || "Telora user",
    }));
  const interviewRows = interviews
    .filter((interview) => interview.candidate_id === candidate?.id)
    .map((interview) => ({
      id: `interview-${interview.id}`,
      type: "interview",
      summary: `Interview ${interview.interview_status || "scheduled"}`,
      detail: [interview.round_type, interview.feedback_status].filter(Boolean).join(" · "),
      created_at: interview.scheduled_at || interview.created_at,
      actor_name: interview.panel_name || "Interview panel",
    }));
  const persisted = activityRows
    .filter((row) => row.candidate_id === candidate?.id)
    .map((row) => ({
      id: row.id,
      type: row.activity_type,
      summary: row.summary,
      detail: row.metadata?.stage ? `Stage: ${row.metadata.stage}` : "",
      created_at: row.created_at,
      actor_name: row.actor_name || "Telora user",
    }));
  const fallback = candidate?.is_demo && !audit.length && !persisted.length
    ? [
        { id: `demo-created-${candidate.id}`, type: "created", summary: "Candidate added", detail: "Telora sample pipeline", created_at: candidate.created_at, actor_name: "Telora" },
        { id: `demo-assigned-${candidate.id}`, type: "assigned", summary: candidate.owner_id ? "Recruiter ownership assigned" : "Awaiting recruiter assignment", detail: "Sample record", created_at: candidate.created_at, actor_name: "Telora" },
        ...(candidate.vacancy_id ? [{ id: `demo-vacancy-${candidate.id}`, type: "vacancy_linked", summary: "Candidate linked to client demand", detail: "Sample vacancy", created_at: candidate.updated_at, actor_name: "Telora" }] : []),
      ]
    : [];
  return [...audit, ...persisted, ...interviewRows, ...fallback].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
};
