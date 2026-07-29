import { useState } from "react";
import Modal from "./Modal";
import { summarizeDemoData } from "../utils/demoData";

export default function SampleDataToggle({ status, busy, onRemove, onRestore }) {
  const [dialog, setDialog] = useState(null);
  const summary = summarizeDemoData(status);
  const enabled = summary.isActive;
  const canToggle = summary.isActive || summary.isRemoved;

  const confirm = async () => {
    const succeeded = enabled
      ? await onRemove()
      : await onRestore(status?.batch_id || null);
    if (succeeded !== false) setDialog(null);
  };

  return (
    <>
      <div className="flex items-center gap-3 rounded-full border border-app bg-surface px-3 py-2 shadow-sm">
        <span className="text-xs font-semibold text-secondary">Sample Data</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`Turn sample data ${enabled ? "off" : "on"}`}
          disabled={busy || !canToggle}
          onClick={() => setDialog(enabled ? "off" : "on")}
          className={`relative h-6 w-11 rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${
            enabled ? "bg-[var(--accent)]" : "bg-zinc-300 dark:bg-zinc-700"
          }`}
        >
          <span
            className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${
              enabled ? "left-6" : "left-1"
            }`}
          />
        </button>
        <span className="w-5 text-xs font-medium text-primary">{enabled ? "On" : "Off"}</span>
      </div>

      {dialog ? (
        <Modal
          title={`Turn sample data ${dialog}?`}
          description={
            dialog === "off"
              ? "This removes only records belonging to the Supabase demo batch. Real customer records will not be affected."
              : "This restores the previous Supabase demo batch and its sample candidates, approvals, and invoice examples."
          }
          onClose={() => !busy && setDialog(null)}
        >
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDialog(null)} className="action-button border border-app bg-surface text-secondary hover:bg-raised">
              Cancel
            </button>
            <button type="button" onClick={confirm} disabled={busy} className="action-button action-primary">
              {busy ? "Updating…" : `Turn ${dialog}`}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
