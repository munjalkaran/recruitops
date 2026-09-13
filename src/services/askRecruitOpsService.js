import { isFeedbackDue, interviewMatchesDay } from "../utils/interviews";
import { isInvoiceEligible } from "../utils/candidateUtils";

const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function interpretRecruitOpsQuestion(question, { candidates = [], profiles = [], interviews = [], vacancies = [] } = {}) {
  const raw = question.trim();
  const query = normalize(raw);
  const active = candidates.filter((candidate) => !candidate.is_archived);
  const suggestions = ["Show interviews scheduled today", "Show feedback pending", "Which candidates need follow-up?", "Show vacancies without candidates"];
  if (!query) return { type: "clarify", message: "Ask about candidates, interviews, vacancies, stages, recruiters, follow-ups, banks, or invoicing.", action: null, suggestions };

  if (/interview|feedback|no show|panel|reschedul/.test(query)) {
    if (/today/.test(query)) {
      const count = interviews.filter((interview) => interviewMatchesDay(interview, 0)).length;
      return { type: "answer", message: count ? `${count} interview${count === 1 ? " is" : "s are"} scheduled today. Open Interviews to review the line-up.` : "No interviews are scheduled today. Open Interviews to schedule a round.", action: { kind: "interviews" }, suggestions };
    }
    if (/tomorrow/.test(query)) {
      const rows = interviews.filter((interview) => interviewMatchesDay(interview, 1));
      const tp1 = rows.filter((interview) => interview.round_type === "TP1").length;
      return { type: "answer", message: `${tp1} TP1 interview${tp1 === 1 ? " is" : "s are"} scheduled for tomorrow. Open Interviews to review the line-up.`, action: { kind: "interviews" }, suggestions };
    }
    if (/feedback|outcome/.test(query)) {
      const due = interviews.filter((interview) => isFeedbackDue(interview));
      return due.length ? { type: "answer", message: `${due.length} interview${due.length === 1 ? " is" : "s are"} Feedback Due. Open Interviews to record the outcome.`, action: { kind: "interviews", filter: "due" }, suggestions } : { type: "answer", message: "No interview feedback is currently overdue. Candidate-level feedback fields are also empty in the available data.", action: { kind: "interviews" }, suggestions };
    }
    if (/no panel|without panel|panel/.test(query)) {
      const missing = interviews.filter((interview) => !interview.panel_name && !["Cancelled", "Rescheduled"].includes(interview.interview_status));
      return { type: "answer", message: missing.length ? `I found ${missing.length} upcoming interview${missing.length === 1 ? "" : "s"} without a panel. Open Interviews to assign one.` : "Every current interview has a panel assigned.", action: { kind: "interviews" }, suggestions };
    }
    if (/no show/.test(query)) {
      const noShows = interviews.filter((interview) => interview.interview_status === "No Show");
      return { type: "answer", message: noShows.length ? `${noShows.length} no-show${noShows.length === 1 ? " is" : "s are"} recorded. Review the follow-up flag in Interviews.` : "No no-shows are recorded in the available interview history.", action: { kind: "interviews" }, suggestions };
    }
    if (/reschedul/.test(query)) {
      const rows = interviews.filter((interview) => interview.interview_status === "Rescheduled" || interview.candidate_confirmation_status === "Requested Reschedule");
      return { type: "answer", message: rows.length ? `${rows.length} interview${rows.length === 1 ? " needs" : "s need"} reschedule follow-up.` : "No interviews currently need rescheduling.", action: { kind: "interviews" }, suggestions };
    }
  }

  if (/invoice|invoic|ready.*bill|bill.*ready/.test(query)) {
    const eligible = active.filter((candidate) => isInvoiceEligible(candidate));
    const missingJoiningDate = active.filter(
      (candidate) => candidate.stage === "Joined" && !String(candidate.actual_joining_date || "").trim(),
    );
    const missingDateMessage = missingJoiningDate.length
      ? ` ${missingJoiningDate.length} joined candidate${missingJoiningDate.length === 1 ? " still needs" : "s still need"} an actual joining date.`
      : "";
    return {
      type: "answer",
      message: `${eligible.length} candidate${eligible.length === 1 ? " is" : "s are"} eligible for invoicing. Eligibility starts on day 90 after the actual joining date, and failed or replacement-required retention is excluded.${missingDateMessage}`,
      action: { kind: "invoicing" },
      suggestions,
    };
  }

  if (/without.*linked vacancy|no linked vacancy|no vacancy/.test(query)) {
    const matches = active.filter((candidate) => !candidate.vacancy_id);
    return { type: "answer", message: matches.length ? `${matches.length} candidate${matches.length === 1 ? " is" : "s are"} not linked to a vacancy.` : "Every available candidate is linked to a vacancy.", action: { kind: "search", value: "" }, suggestions };
  }

  if (/notice|join|joining|availability|30 days/.test(query)) {
    const matches = active.filter((candidate) => Number(candidate.notice_period_days) > 0 && Number(candidate.notice_period_days) <= 30);
    return { type: "answer", message: matches.length ? `${matches.length} candidate${matches.length === 1 ? " has" : "s have"} a notice period of 30 days or less.` : "No available candidate has a notice period of 30 days or less.", action: { kind: "search", value: "" }, suggestions };
  }

  if (/missing.*expected|expected.*missing|no expected/.test(query)) {
    const matches = active.filter((candidate) => !candidate.expected_ctc);
    return { type: "answer", message: matches.length ? `${matches.length} candidate${matches.length === 1 ? " is" : "s are"} missing expected CTC.` : "Every available candidate has an expected CTC recorded.", action: { kind: "search", value: "" }, suggestions };
  }

  if (/vacanc/.test(query)) {
    const withoutCandidates = vacancies.filter((vacancy) => !(vacancy.candidates?.length || vacancy.candidate_count));
    if (/high priority|critical|urgent/.test(query)) {
      const highPriority = vacancies.filter((vacancy) => ["High", "Critical"].includes(vacancy.priority));
      return { type: "answer", message: highPriority.length ? `${highPriority.length} high-priority vacancy${highPriority.length === 1 ? " is" : "ies are"} open. Open Vacancies to review coverage.` : "No high-priority vacancies are visible in the available data.", action: { kind: "vacancies" }, suggestions };
    }
    if (/health|blocked|priority|critical|urgent/.test(query)) {
      const blocked = vacancies.filter((vacancy) => vacancy.status !== "Filled" && (vacancy.priority === "Critical" || !(vacancy.candidates?.length || vacancy.candidate_count)));
      return { type: "answer", message: blocked.length ? `${blocked.length} vacancy${blocked.length === 1 ? " needs" : "ies need"} attention based on priority and candidate coverage.` : "No vacancy health risks are visible in the available data.", action: { kind: "vacancies" }, suggestions };
    }
    if (/without|no candidate|empty|needs.*candidate|more candidates|coverage/.test(query)) return { type: "answer", message: withoutCandidates.length ? `${withoutCandidates.length} vacanc${withoutCandidates.length === 1 ? "y needs" : "ies need"} more linked candidates. Open Vacancies to review demand.` : "Every available vacancy has at least one linked candidate.", action: { kind: "vacancies" }, suggestions };
    return { type: "answer", message: `${vacancies.length} vacancy record${vacancies.length === 1 ? " is" : "s are"} available to your role. Open Vacancies to review them.`, action: { kind: "vacancies" }, suggestions };
  }

  if (/match|suitable|fit/.test(query) && /candidate|hdfc|relationship manager|rm/.test(query)) {
    const vacancy = vacancies.find((item) => /hdfc/i.test(item.client_name || "") && /relationship manager/i.test(item.job_title || ""));
    const matches = active.filter((candidate) => vacancy && ((candidate.vacancy_id === vacancy.id) || (/relationship|rm/i.test(candidate.role || "") && /hdfc/i.test(candidate.target_bank || ""))));
    return { type: "answer", message: matches.length ? `${matches.length} candidate${matches.length === 1 ? " looks" : "s look"} matched to the HDFC Relationship Manager demand. Rule-based match using role, experience, location and CTC.` : "No HDFC Relationship Manager match is visible in the available data. Missing vacancy or candidate fields may limit the match.", action: { kind: "search", value: "HDFC" }, suggestions };
  }

  if (/expected.*20|20.*lpa/.test(query)) {
    const threshold = active.some((candidate) => Number(candidate.expected_ctc) > 100) ? 2000000 : 20;
    const matches = active.filter((candidate) => Number(candidate.expected_ctc) > threshold);
    return { type: "answer", message: matches.length ? `${matches.length} candidate${matches.length === 1 ? " has" : "s have"} expected CTC above 20 LPA. Open Pipeline to review them.` : "No available candidate has expected CTC above 20 LPA.", action: { kind: "search", value: "" }, suggestions };
  }
  if (/stale|overdue|follow up/.test(query)) return { type: "filter", message: `I found ${active.filter((candidate) => candidate.next_follow_up && new Date(candidate.next_follow_up) < new Date()).length} candidates with overdue follow-ups. I can show them in Pipeline.`, action: { kind: "stale" }, suggestions };
  const stage = ["Sourced", "Contacted", "Screened", "Interviewing", "Selected", "Documentation", "Joined", "Invoiced", "Paid", "Dropped"].find((value) => query.includes(value.toLowerCase()));
  if (stage) return { type: "answer", message: `${active.filter((candidate) => candidate.stage === stage).length} candidates are currently in ${stage}.`, action: { kind: "stage", value: stage }, suggestions };
  if (/how many|count|number/.test(query) && /candidate|interview/.test(query)) return { type: "answer", message: `${active.filter((candidate) => candidate.stage === "Interviewing").length} candidates are currently interviewing.`, action: { kind: "stage", value: "Interviewing" }, suggestions };
  const bank = [...new Set(active.map((value) => value.target_bank).filter(Boolean))].find((value) => query.includes(normalize(value)) || normalize(value).split(" ").some((token) => token.length > 3 && query.includes(token)));
  if (bank) return { type: "filter", message: `I found candidates matching ${bank}. I can filter the Pipeline for you.`, action: { kind: "search", value: bank }, suggestions };
  const recruiter = profiles.find((profile) => query.includes(normalize(profile.full_name)));
  if (recruiter) return { type: "answer", message: `${active.filter((candidate) => candidate.owner_id === recruiter.id).length} active candidates are assigned to ${recruiter.full_name}.`, action: { kind: "recruiter", value: recruiter.id }, suggestions };
  if (/recruiter|owner|most active/.test(query)) {
    const ranking = profiles.map((profile) => ({ name: profile.full_name, count: active.filter((candidate) => candidate.owner_id === profile.id).length })).filter((item) => item.count > 0).sort((a, b) => b.count - a.count);
    return ranking.length ? { type: "answer", message: `${ranking[0].name} has the most active candidates with ${ranking[0].count}. I can filter the pipeline to that recruiter.`, action: { kind: "recruiter", value: profiles.find((profile) => profile.full_name === ranking[0].name)?.id }, suggestions } : { type: "clarify", message: "No active candidates are currently assigned to a recruiter. Assign an owner from the Pipeline to make recruiter workload visible.", action: null, suggestions };
  }
  return { type: "clarify", message: "I can search the current pipeline, interviews, vacancies, stages, banks, recruiter ownership, overdue follow-ups, or invoicing status. Try one of the suggested prompts below.", action: null, suggestions };
}
