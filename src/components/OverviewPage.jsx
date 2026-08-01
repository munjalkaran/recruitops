import { ArrowRight, Clock3 } from "lucide-react";
import SummaryStats from "./SummaryStats";
import SampleDataToggle from "./SampleDataToggle";
import { isAdmin } from "../utils/permissions";
import { getTimeAwareGreeting } from "../utils/greeting";

export default function OverviewPage({
  candidates,
  interviews = [],
  pendingApprovalsCount,
  profile,
  demoStatus,
  demoBusy,
  onRemoveDemo,
  onRestoreDemo,
  onNavigate,
  onSelectSummary,
}) {
  const greeting = getTimeAwareGreeting(profile);
  const upcoming = candidates
    .filter((candidate) => candidate.next_follow_up)
    .sort((a, b) => String(a.next_follow_up).localeCompare(String(b.next_follow_up)))
    .slice(0, 4);

  return (
    <div className="page-enter mx-auto max-w-[1500px] space-y-6">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--accent)]">Executive workspace</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            {greeting}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
            A view of the pipeline, follow-ups, approvals, and placements that need attention.
          </p>
        </div>
        {isAdmin(profile) ? (
          <SampleDataToggle
            status={demoStatus}
            busy={demoBusy}
            onRemove={onRemoveDemo}
            onRestore={onRestoreDemo}
          />
        ) : null}
      </section>

      <SummaryStats
        candidates={candidates}
        interviews={interviews}
        pendingApprovalsCount={pendingApprovalsCount}
        onSelect={onSelectSummary}
      />

      <section className="w-full">
        <div className="premium-card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg text-primary">Upcoming follow-ups</h3>
              <p className="mt-1 text-sm text-secondary">The next conversations on your team’s calendar.</p>
            </div>
            <button type="button" onClick={() => onSelectSummary("overdue")} className="inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] hover:underline">
              View all <ArrowRight size={15} />
            </button>
          </div>
          <div className="mt-4 divide-y divide-[var(--border)]">
            {upcoming.length ? upcoming.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => onSelectSummary("candidate", candidate)}
                className="flex w-full items-center justify-between gap-4 py-3 text-left hover:translate-x-0.5"
              >
                <span>
                  <span className="block text-sm font-semibold text-primary">{candidate.name}</span>
                  <span className="mt-1 block text-xs text-secondary">{candidate.target_bank || "No target bank"} · {candidate.stage}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-secondary">
                  <Clock3 size={14} /> {candidate.next_follow_up}
                </span>
              </button>
            )) : (
              <p className="py-10 text-center text-sm text-secondary">No upcoming follow-ups.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
