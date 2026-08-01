import { DEMO_ORGANISATION_ID, DEMO_PROFILE_IDS } from "../constants/pipeline";

const at = (days, hours = 10) => { const date = new Date(); date.setDate(date.getDate() + days); date.setHours(hours, 0, 0, 0); return date; };
const row = (id, candidate_id, vacancy_id, round_type, offset, interview_status = "Scheduled", feedback_status = "Not Due", confirmation = "Pending", scores = {}) => { const date = at(offset); return { id, organisation_id: DEMO_ORGANISATION_ID, candidate_id, vacancy_id, round_type, round_number: round_type === "TP2" ? 2 : 1, scheduled_date: date.toISOString().slice(0, 10), scheduled_time: date.toTimeString().slice(0, 5), scheduled_at: date.toISOString(), timezone: "Asia/Kolkata", mode: "Video", meeting_link: "https://example.com/telora-demo", panel_name: "Demo hiring panel", candidate_confirmation_status: confirmation, interview_status, feedback_status, is_demo: true, created_by: DEMO_PROFILE_IDS.admin, updated_at: new Date().toISOString(), ...scores }; };

export const mockInterviews = [
  row("88888888-0001-4888-8888-888888888001", "66666666-0008-4666-8666-666666666008", "77777777-0001-4777-8777-777777777001", "TP1", 0),
  row("88888888-0002-4888-8888-888888888002", "66666666-0009-4666-8666-666666666009", "77777777-0003-4777-8777-777777777003", "TP1", 1, "Scheduled", "Not Due", "Confirmed"),
  row("88888888-0003-4888-8888-888888888003", "66666666-0001-4666-8666-666666666001", "77777777-0001-4777-8777-777777777001", "Client", 3),
  row("88888888-0004-4888-8888-888888888004", "66666666-0002-4666-8666-666666666002", "77777777-0002-4777-8777-777777777002", "TP2", -1, "Completed", "Pending", "Confirmed"),
  row("88888888-0005-4888-8888-888888888005", "66666666-0003-4666-8666-666666666003", "77777777-0004-4777-8777-777777777004", "TP1", -2, "Completed", "Received", "Confirmed", { technical_fit_score: 4, communication_score: 4, role_fit_score: 5, stability_motivation_score: 4, recommendation: "Proceed", feedback_summary: "Clear communication and relevant field experience." }),
  row("88888888-0006-4888-8888-888888888006", "66666666-0004-4666-8666-666666666004", "77777777-0005-4777-8777-777777777005", "Client", -3, "No Show", "Escalated", "Confirmed"),
  row("88888888-0007-4888-8888-888888888007", "66666666-0006-4666-8666-666666666006", "77777777-0005-4777-8777-777777777005", "TP2", -4, "Rescheduled", "Not Due", "Requested Reschedule"),
];

mockInterviews[0].panel_name = "";
mockInterviews[1].recommendation = "Operations Fit";
mockInterviews[2].recommendation = "Reject";
mockInterviews[2].rejection_reason = "Role scope and location were not aligned.";
mockInterviews[3].recommendation = "Hold";
mockInterviews[4].recommendation = "Proceed";
mockInterviews[4].feedback_summary = "Clear communication and relevant field experience.";
mockInterviews[6].recommendation = "Reschedule";
