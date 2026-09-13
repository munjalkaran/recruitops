import { AlertTriangle, BriefcaseBusiness, CheckCircle2, CircleDollarSign, ClipboardCheck, Users } from "lucide-react";
import { formatCurrency, isCandidateStale, isInvoiceEligible } from "../utils/candidateUtils";
import { getInterviewScheduledAt, isFeedbackDue, interviewMatchesDay } from "../utils/interviews";

export default function SummaryStats({ candidates, interviews = [], pendingApprovalsCount = 0, onSelect }) {
  const active = candidates.filter((candidate) => !candidate.is_archived);
  const stale = active.filter((candidate) => isCandidateStale(candidate));
  const interviewing = active.filter((candidate) => candidate.stage === "Interviewing");
  const selected = active.filter((candidate) => candidate.stage === "Selected");
  const monthPrefix = new Date().toISOString().slice(0, 7);
  const joinedThisMonth = active.filter((candidate) => {
    const joinedDate = candidate.joined_at || candidate.last_contact || candidate.updated_at;
    return candidate.stage === "Joined" && String(joinedDate || "").startsWith(monthPrefix);
  });
  const readyToInvoice = active.filter((candidate) => isInvoiceEligible(candidate));
  const readyValue = readyToInvoice.reduce((total, candidate) => total + (Number(candidate.fee) || 0), 0);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const noShowsThisWeek = interviews.filter((interview) => {
    const scheduled = getInterviewScheduledAt(interview);
    return interview.interview_status === "No Show" && scheduled && scheduled >= weekStart;
  });

  const stats = [
    { id: "active", label: "Active Candidates", value: active.length, icon: Users },
    { id: "overdue", label: "Overdue Follow-ups", value: stale.length, icon: AlertTriangle, tone: "text-amber-700 dark:text-amber-300" },
    { id: "interviewing", label: "Interviewing", value: interviewing.length, icon: BriefcaseBusiness },
    { id: "selected", label: "Selected", value: selected.length, icon: CheckCircle2 },
    { id: "joined", label: "Joined This Month", value: joinedThisMonth.length, icon: CheckCircle2 },
    { id: "invoice", label: "Ready to Invoice", value: readyToInvoice.length, detail: formatCurrency(readyValue), icon: CircleDollarSign },
    { id: "approvals", label: "Pending Approvals", value: pendingApprovalsCount, icon: ClipboardCheck, tone: "text-amber-700 dark:text-amber-300" },
    { id: "interviews", label: "Interviews Today", value: interviews.filter((interview) => interviewMatchesDay(interview, 0)).length, icon: BriefcaseBusiness },
    { id: "feedbackDue", label: "Feedback Due", value: interviews.filter((interview) => isFeedbackDue(interview)).length, icon: ClipboardCheck, tone: "text-amber-700 dark:text-amber-300" },
    { id: "noShows", label: "No Shows This Week", value: noShowsThisWeek.length, icon: AlertTriangle, tone: "text-rose-700 dark:text-rose-300" },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <button key={stat.label} type="button" onClick={() => onSelect?.(stat.id)} className="premium-card flex min-h-32 flex-col p-4 text-left transition hover:-translate-y-1 hover:border-[var(--accent)]">
            <div className={`mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-soft)] ${stat.tone || "text-[var(--accent)]"}`}>
              <Icon size={16} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.11em] text-secondary">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold text-primary">{stat.value}</p>
            {stat.detail ? <p className="mt-1 text-xs text-secondary">{stat.detail}</p> : null}
          </button>
        );
      })}
    </section>
  );
}
