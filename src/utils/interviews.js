export const INTERVIEW_ROUNDS = ["TP1", "TP2", "Client", "HR", "Other"];
export const INTERVIEW_MODES = ["Video", "Phone", "In Person", "Client Platform", "Other"];
export const CONFIRMATION_STATUSES = ["Pending", "Confirmed", "Requested Reschedule", "Declined", "No Response"];
export const INTERVIEW_STATUSES = ["Scheduled", "Completed", "No Show", "Cancelled", "Rescheduled"];
export const FEEDBACK_STATUSES = ["Not Due", "Pending", "Received", "Escalated"];
export const RECOMMENDATIONS = ["Proceed", "Reject", "Hold", "Operations Fit", "Different Role", "Reschedule", "No Decision"];
export const FEEDBACK_GRACE_MINUTES = 30;

export const getInterviewScheduledAt = (interview) => {
  if (interview?.scheduled_at) return new Date(interview.scheduled_at);
  if (!interview?.scheduled_date || !interview?.scheduled_time) return null;
  const time = String(interview.scheduled_time).slice(0, 8);
  return new Date(`${interview.scheduled_date}T${time}`);
};

export const isFeedbackDue = (interview, now = new Date(), graceMinutes = FEEDBACK_GRACE_MINUTES) => {
  if (!interview || ["Cancelled", "Rescheduled"].includes(interview.interview_status) || interview.feedback_status === "Received") return false;
  const scheduledAt = getInterviewScheduledAt(interview);
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) return false;
  return now.getTime() >= scheduledAt.getTime() + graceMinutes * 60 * 1000;
};

export const getInterviewAttention = (interview, now = new Date()) => {
  const issues = [];
  if (isFeedbackDue(interview, now)) issues.push("Feedback overdue");
  const scheduledAt = getInterviewScheduledAt(interview);
  if (interview?.candidate_confirmation_status === "Pending" && scheduledAt && scheduledAt.getTime() - now.getTime() < 24 * 60 * 60 * 1000 && scheduledAt > now) issues.push("Confirmation pending");
  if (interview?.interview_status === "No Show") issues.push("No-show follow-up");
  if (interview?.interview_status === "Scheduled" && !interview.panel_name) issues.push("Panel missing");
  if (interview?.interview_status === "Scheduled" && ["Video", "Client Platform"].includes(interview.mode) && !interview.meeting_link) issues.push("Meeting link missing");
  if (interview?.interview_status === "Scheduled" && interview.mode === "In Person" && !interview.venue) issues.push("Venue missing");
  if (interview?.candidate_confirmation_status === "Requested Reschedule") issues.push("Reschedule requested");
  if (interview?.escalation_required) issues.push(interview.escalation_reason || "Escalation open");
  return issues;
};

export const formatInterviewDateTime = (interview) => {
  const date = getInterviewScheduledAt(interview);
  if (!date || Number.isNaN(date.getTime())) return "Schedule pending";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
};

export const interviewMatchesDay = (interview, day, now = new Date()) => {
  const scheduled = getInterviewScheduledAt(interview);
  if (!scheduled) return false;
  const target = new Date(now);
  target.setDate(target.getDate() + day);
  return scheduled.toDateString() === target.toDateString();
};
