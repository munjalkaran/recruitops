import { AlertTriangle, BriefcaseBusiness, CheckCircle2, CircleDollarSign, Users } from "lucide-react";
import { formatCurrency, isCandidateStale } from "../utils/candidateUtils";

export default function SummaryStats({ candidates }) {
  const active = candidates.filter((candidate) => !candidate.is_archived);
  const stale = active.filter((candidate) => isCandidateStale(candidate));
  const interviewing = active.filter((candidate) => candidate.stage === "Interviewing");
  const selected = active.filter((candidate) => candidate.stage === "Selected");
  const joinedThisMonth = active.filter(
    (candidate) =>
      candidate.stage === "Joined" &&
      String(candidate.last_contact || candidate.updated_at || "").startsWith("2026-07"),
  );
  const toInvoice = active
    .filter((candidate) => candidate.stage === "Joined")
    .reduce((total, candidate) => total + (Number(candidate.fee) || 0), 0);

  const stats = [
    { label: "Active Candidates", value: active.length, icon: Users, tone: "text-slate-700 dark:text-zinc-100" },
    { label: "Overdue Follow-ups", value: stale.length, icon: AlertTriangle, tone: "text-amber-700 dark:text-amber-300" },
    { label: "Interviewing", value: interviewing.length, icon: BriefcaseBusiness, tone: "text-indigo-700 dark:text-indigo-300" },
    { label: "Selected", value: selected.length, icon: CheckCircle2, tone: "text-violet-700 dark:text-violet-300" },
    { label: "Joined This Month", value: joinedThisMonth.length, icon: CheckCircle2, tone: "text-emerald-700 dark:text-emerald-300" },
    { label: "Ready to Invoice", value: formatCurrency(toInvoice), icon: CircleDollarSign, tone: "text-teal-700 dark:text-teal-300" },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className="rounded-lg border border-app bg-surface px-3 py-3">
            <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-raised ${stat.tone}`}>
              <Icon size={16} />
            </div>
            <p className="text-xs font-bold uppercase tracking-wide text-secondary">{stat.label}</p>
            <p className="mt-1 text-lg font-extrabold text-primary">{stat.value}</p>
          </div>
        );
      })}
    </section>
  );
}
