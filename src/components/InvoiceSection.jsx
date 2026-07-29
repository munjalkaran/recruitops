import { FileDown, ReceiptText } from "lucide-react";
import { formatCurrency, getRecruiterName, groupInvoiceByBank } from "../utils/candidateUtils";

export default function InvoiceSection({
  candidates,
  profiles,
  onDownloadInvoice,
  onMarkInvoiced,
}) {
  const groups = groupInvoiceByBank(candidates);
  const grandTotal = groups.reduce((total, group) => total + group.subtotal, 0);
  const joinedCount = groups.reduce((total, group) => total + group.candidates.length, 0);
  const hasJoinedCandidates = groups.length > 0;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-app bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
            Invoicing
          </p>
          <h2 className="mt-1 text-xl font-semibold text-primary">
            {formatCurrency(grandTotal)} ready across {joinedCount} joined candidates
          </h2>
          <p className="mt-1 text-sm text-secondary">
            Joined candidates grouped by bank/NBFC for month-end billing.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onDownloadInvoice}
            disabled={!hasJoinedCandidates}
            className="action-button border border-app bg-surface text-secondary hover:bg-raised hover:text-primary"
          >
            <FileDown size={16} strokeWidth={2.2} />
            Download invoice CSV
          </button>
          <button
            type="button"
            onClick={onMarkInvoiced}
            disabled={!hasJoinedCandidates}
            className="action-button action-primary"
          >
            <ReceiptText size={16} strokeWidth={2.2} />
            Mark all as Invoiced
          </button>
        </div>
      </div>

      {!hasJoinedCandidates ? (
        <div className="rounded-lg border border-dashed border-app bg-surface px-4 py-12 text-center text-sm text-secondary">
          No Joined candidates are ready to invoice.
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
