import { useState } from "react";
import { X } from "lucide-react";
import Modal from "./Modal";

export default function SampleDataBanner({ onRemove, onHide, busy }) {
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  const remove = async () => {
    if ((await onRemove()) !== false) {
      setConfirming(false);
      setConfirmation("");
    }
  };

  return (
    <>
      <div className="glass-panel mb-4 flex flex-col gap-3 rounded-lg border border-sky-200 px-4 py-3 text-sm text-sky-900 dark:border-sky-900 dark:text-sky-100 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-semibold">
          Sample data is active. Explore the workflow, then remove it before adding real candidates.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-lg bg-sky-700 px-3 py-2 text-xs font-bold text-white hover:bg-sky-800"
          >
            Remove demo data
          </button>
          <button
            type="button"
            onClick={onHide}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-bold hover:bg-sky-100 dark:hover:bg-sky-900"
          >
            <X size={14} /> Hide banner
          </button>
        </div>
      </div>

      {confirming ? (
        <Modal
          title="Remove sample data?"
          description="This will hide all sample candidates, approvals, archived records, and invoice examples from normal use. Real customer data will not be affected. You can restore the sample data later."
          onClose={() => !busy && setConfirming(false)}
        >
          <div className="space-y-4">
            <label className="block text-sm font-bold text-primary">
              Type REMOVE SAMPLE DATA to confirm
              <input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="mt-2 h-10 w-full rounded-lg border border-app bg-raised px-3 text-sm text-primary outline-none focus:border-rose-500"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirming(false)} className="action-button border border-app bg-surface text-secondary hover:bg-raised">
                Cancel
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={busy || confirmation !== "REMOVE SAMPLE DATA"}
                className="action-button bg-rose-600 text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Removing…" : "Remove sample data"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
