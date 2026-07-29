import { ArrowRight, Clock3 } from "lucide-react";
import SummaryStats from "./SummaryStats";
import SampleDataToggle from "./SampleDataToggle";
import { isAdmin } from "../utils/permissions";

export default function OverviewPage({
  candidates,
  pendingApprovalsCount,
  profile,
  demoStatus,
  demoBusy,
  onRemoveDemo,
  onRestoreDemo,
  onNavigate,
  onSelectSummary,
}) {
  const firstName = profile?.full_name?.split(" ")[0] || "there";
  const upcoming = candidates
    .filter((candidate) => candidate.next_follow_up)
    .sort((a, b) => String(a.next_follow_up).localeCompare(String(b.next_follow_up)))
    .slice(0, 4);

  return (
    <div className="page-enter mx-auto max-w-[1500px] space-y-8">
      <section className="flex flex-col gap-5 pt-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--accent)]">Executive workspace</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-primary">
            Welcome back, {firstName}.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
            A calm view of the pipeline, follow-ups, approvals, and placements that need attention.
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
        pendingApprovalsCount={pendingApprovalsCount}
        onSelect={onSelectSummary}
      />

      <section className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="premium-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg text-primary">Upcoming follow-ups</h3>
              <p className="mt-1 text-sm text-secondary">The next conversations on your team’s calendar.</p>
            </div>
            <button type="button" onClick={() => onSelectSummary("overdue")} className="inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] hover:underline">
              View all <ArrowRight size={15} />
            </button>
          </div>
          <div className="mt-6 divide-y divide-[var(--border)]">
            {upcoming.length ? upcoming.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => onSelectSummary("candidate", candidate)}
                className="flex w-full items-center justify-between gap-4 py-4 text-left hover:translate-x-0.5"
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

        <div className="premium-card flex flex-col justify-between p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">Pipeline focus</p>
            <h3 className="mt-3 text-xl text-primary">Keep the sheet for the work.</h3>
            <p className="mt-3 text-sm leading-6 text-secondary">
              Search, filter, update stages, manage candidates, and run CSV actions from the dedicated Pipeline page.
            </p>
          </div>
          <button type="button" onClick={() => onNavigate("pipeline")} className="action-button action-primary mt-8 self-start">
            Open pipeline <ArrowRight size={16} />
          </button>
        </div>
      </section>
    </div>
  );
}
