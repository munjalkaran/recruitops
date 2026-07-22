import { CANDIDATE_FIELD_LABELS } from "../constants/pipeline";

export default function MyRequestsPage({ requests, candidates }) {
  return (
    <section className="overflow-hidden rounded-lg border border-app bg-surface">
      <div className="overflow-auto">
        <table className="w-full min-w-[840px] text-left text-sm">
          <thead className="bg-raised text-xs uppercase text-secondary">
            <tr>
              <th className="px-3 py-2">Candidate</th>
              <th className="px-3 py-2">Field</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Admin comment</th>
              <th className="px-3 py-2">Submitted date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {requests.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-4 py-12 text-center text-secondary">
                  No correction requests submitted yet.
                </td>
              </tr>
            ) : (
              requests.map((request) => {
                const candidate = candidates.find((item) => item.id === request.candidate_id);
                return (
                  <tr key={request.id}>
                    <td className="px-3 py-2 font-bold text-primary">
                      {candidate?.name || "Candidate"}
                    </td>
                    <td className="px-3 py-2 text-secondary">
                      {CANDIDATE_FIELD_LABELS[request.field_name] || request.field_name}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full border border-app bg-raised px-2.5 py-1 text-xs font-bold capitalize text-secondary">
                        {request.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-secondary">{request.review_comment || "-"}</td>
                    <td className="px-3 py-2 text-secondary">
                      {String(request.created_at || "").slice(0, 10)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
