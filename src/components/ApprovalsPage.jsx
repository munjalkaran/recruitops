import { CANDIDATE_FIELD_LABELS } from "../constants/pipeline";
import { getRecruiterName } from "../utils/candidateUtils";

const displayValue = (value) => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export default function ApprovalsPage({
  requests,
  candidates,
  profiles,
  onReview,
}) {
  const pending = requests.filter((request) => request.status === "pending");

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-app bg-surface p-4">
        <p className="text-sm font-bold text-secondary">Pending requests count</p>
        <p className="mt-1 text-2xl font-semibold text-primary">{pending.length}</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-app bg-surface">
        <div className="overflow-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-raised text-xs uppercase text-secondary">
              <tr>
                <th className="px-3 py-2">Candidate</th>
                <th className="px-3 py-2">Field</th>
                <th className="px-3 py-2">Current value</th>
                <th className="px-3 py-2">Proposed value</th>
                <th className="px-3 py-2">Reason</th>
                <th className="px-3 py-2">Requested by</th>
                <th className="px-3 py-2">Requested date</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {pending.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center text-secondary">
                    No pending approvals.
                  </td>
                </tr>
              ) : (
                pending.map((request) => {
                  const candidate = candidates.find((item) => item.id === request.candidate_id);
                  return (
                    <tr key={request.id}>
                      <td className="px-3 py-2 font-bold text-primary">
                        {candidate?.name || "Candidate"}
                      </td>
                      <td className="px-3 py-2 text-secondary">
                        {CANDIDATE_FIELD_LABELS[request.field_name] || request.field_name}
                      </td>
                      <td className="px-3 py-2 text-secondary">{displayValue(request.old_value)}</td>
                      <td className="px-3 py-2 text-secondary">
                        {displayValue(request.proposed_value)}
                      </td>
                      <td className="px-3 py-2 text-secondary">{request.reason}</td>
                      <td className="px-3 py-2 text-secondary">
                        {getRecruiterName(profiles, request.requested_by)}
                      </td>
                      <td className="px-3 py-2 text-secondary">
                        {String(request.created_at || "").slice(0, 10)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => onReview(request, "approved")}
                            className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => onReview(request, "rejected")}
                            className="h-8 rounded-lg bg-rose-600 px-3 text-xs font-bold text-white hover:bg-rose-700"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
