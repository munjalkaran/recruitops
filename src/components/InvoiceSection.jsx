import { CalendarClock, FileDown, FileText, ReceiptText } from "lucide-react";
import { formatCurrency, getRecruiterName, groupInvoiceByBank } from "../utils/candidateUtils";

export default function InvoiceSection({
  candidates,
  profiles,
  onDownloadInvoice,
  onDownloadInvoicePdf,
  onMarkInvoiced,
  billingSettings = {},
  organisationName = "Hiring Spartans",
}) {
  const groups = groupInvoiceByBank(candidates);
  const grandTotal = groups.reduce((total, group) => total + group.subtotal, 0);
  const eligibleCount = groups.reduce((total, group) => total + group.candidates.length, 0);
  const hasEligibleCandidates = groups.length > 0;
  const joinedWithoutDate = candidates.filter(
    (candidate) => candidate.stage === "Joined" && !candidate.is_archived && !String(candidate.actual_joining_date || "").trim(),
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-app bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
            Invoicing
          </p>
          <h2 className="mt-1 text-xl font-semibold text-primary">
            {formatCurrency(grandTotal)} ready across {eligibleCount} eligible candidates
          </h2>
          <p className="mt-1 text-sm text-secondary">
            Candidates become eligible on day 90 after their actual joining date, unless retention failed or requires replacement.
          </p>
          {(!billingSettings.legal_name || !billingSettings.billing_address) ? <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">Billing details are incomplete. PDF output will omit unconfigured legal and tax fields.</p> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onDownloadInvoice}
            disabled={!hasEligibleCandidates}
            className="action-button border border-app bg-surface text-secondary hover:bg-raised hover:text-primary"
          >
            <FileDown size={16} strokeWidth={2.2} />
            Download invoice CSV
          </button>
          <button
            type="button"
            onClick={onDownloadInvoicePdf}
            disabled={!hasEligibleCandidates}
            className="glass-control action-button border"
            title="Uses only billing details configured in Administration"
          >
            <FileText size={16} />
            Download invoice PDF
          </button>
          <button
            type="button"
            onClick={onMarkInvoiced}
            disabled={!hasEligibleCandidates}
            className="action-button action-primary"
          >
            <ReceiptText size={16} strokeWidth={2.2} />
            Mark all as Invoiced
          </button>
        </div>
      </div>

      {joinedWithoutDate.length ? (
        <aside className="premium-card flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
            <CalendarClock size={17} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-primary">
              {joinedWithoutDate.length} joined candidate{joinedWithoutDate.length === 1 ? " needs" : "s need"} an actual joining date
            </h3>
            <p className="mt-1 text-sm leading-6 text-secondary">
              Add the date in the candidate profile to start the 90-day eligibility period.
            </p>
            <p className="mt-2 text-xs font-medium text-secondary">
              {joinedWithoutDate.slice(0, 5).map((candidate) => candidate.name || "Unnamed candidate").join(" · ")}
              {joinedWithoutDate.length > 5 ? ` · +${joinedWithoutDate.length - 5} more` : ""}
            </p>
          </div>
        </aside>
      ) : null}

      {!hasEligibleCandidates ? (
        <div className="rounded-lg border border-dashed border-app bg-surface px-4 py-12 text-center text-sm text-secondary">
          No candidates have reached invoice eligibility. Joined placements become eligible on day 90.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {groups.map((group) => (
            <article key={group.bank} className="overflow-hidden rounded-lg border border-app bg-surface">
              <div className="flex items-center justify-between border-b border-app bg-raised px-4 py-3">
                <h3 className="font-semibold text-primary">{group.bank}</h3>
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                  {formatCurrency(group.subtotal)}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-surface text-[11px] uppercase tracking-wide text-secondary">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Candidate</th>
                      <th className="px-4 py-2.5 font-semibold">Role</th>
                      <th className="px-4 py-2.5 font-semibold">Recruiter</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Fee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {group.candidates.map((candidate) => (
                      <tr key={candidate.id}>
                        <td className="px-4 py-3 font-bold text-primary">
                          {candidate.name || "Unnamed candidate"}
                        </td>
                        <td className="px-4 py-3 text-secondary">{candidate.role || "-"}</td>
                        <td className="px-4 py-3 text-secondary">
                          {getRecruiterName(profiles, candidate.owner_id)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-primary">
                          {formatCurrency(candidate.fee)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
