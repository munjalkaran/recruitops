import { useEffect, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import Modal from "./Modal";
import { summarizeDemoData } from "../utils/demoData";

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "—";

export default function DemoDataManager({ status, busy, onRemove, onRestore }) {
  const [dialog, setDialog] = useState(null);
  const [confirmation, setConfirmation] = useState("");
  const summary = summarizeDemoData(status);

  useEffect(() => setConfirmation(""), [dialog]);

  const confirmRemove = async () => {
    if ((await onRemove()) !== false) setDialog(null);
  };

  const confirmRestore = async () => {
    if ((await onRestore(status?.batch_id || null)) !== false) setDialog(null);
  };

  return (
    <>
      <section className="rounded-lg border border-app bg-surface p-5">
        <h2 className="text-lg font-semibold text-primary">Sample data</h2>
        <p className="mt-1 text-sm text-secondary">
          Reversible Hiring Spartans examples for demonstrations and onboarding.
        </p>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-app bg-raised p-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-secondary">Status</dt>
            <dd className="mt-1 font-bold text-primary">
              {summary.isActive ? "Active" : summary.isRemoved ? "Removed" : "Not seeded"}
            </dd>
          </div>
          <div className="rounded-lg border border-app bg-raised p-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-secondary">Candidates</dt>
            <dd className="mt-1 font-bold text-primary">{summary.count}</dd>
          </div>
          <div className="rounded-lg border border-app bg-raised p-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-secondary">Batch created</dt>
            <dd className="mt-1 text-sm font-semibold text-primary">{formatDate(status?.created_at)}</dd>
          </div>
          <div className="rounded-lg border border-app bg-raised p-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-secondary">Last removed</dt>
            <dd className="mt-1 text-sm font-semibold text-primary">{formatDate(status?.removed_at)}</dd>
          </div>
          <div className="rounded-lg border border-app bg-raised p-3 sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-secondary">Last restored</dt>
            <dd className="mt-1 text-sm font-semibold text-primary">{formatDate(status?.restored_at)}</dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap gap-2">
          {summary.isActive ? (
            <button
              type="button"
              onClick={() => setDialog("remove")}
              disabled={busy}
              className="action-button border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
            >
              <Trash2 size={16} /> Remove demo data
            </button>
          ) : null}
          {summary.isRemoved ? (
            <button
              type="button"
              onClick={() => setDialog("restore")}
              disabled={busy}
              className="action-button action-primary"
            >
              <RotateCcw size={16} /> Restore sample data
            </button>
          ) : null}
          {!status ? (
            <p className="text-sm text-secondary">
              Run <code>supabase/seed.sql</code> after creating the two demo recruiter profiles.
            </p>
          ) : null}
        </div>
      </section>

      {dialog === "remove" ? (
        <Modal
          title="Remove sample data?"
          description="This will hide all sample candidates, approvals, archived records, and invoice examples from normal use. Real customer data will not be affected. You can restore the sample data later."
          onClose={() => !busy && setDialog(null)}
        >
          <div className="space-y-4">
            <label className="block text-sm font-bold text-primary">
              Type REMOVE SAMPLE DATA to confirm
              <input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
                className="mt-2 h-10 w-full rounded-lg border border-app bg-raised px-3 text-sm text-primary outline-none focus:border-rose-500"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDialog(null)} className="action-button border border-app bg-surface text-secondary hover:bg-raised">
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemove}
                disabled={busy || confirmation !== "REMOVE SAMPLE DATA"}
                className="action-button bg-rose-600 text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Removing…" : "Remove sample data"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {dialog === "restore" ? (
        <Modal
          title="Restore sample data?"
          description="Restore the previous sample dataset? This will make the demo candidates and examples visible again."
          onClose={() => !busy && setDialog(null)}
        >
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDialog(null)} className="action-button border border-app bg-surface text-secondary hover:bg-raised">
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmRestore}
              disabled={busy}
              className="action-button action-primary disabled:opacity-50"
            >
              {busy ? "Restoring…" : "Restore sample data"}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
