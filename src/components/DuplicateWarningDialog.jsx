import Modal from "./Modal";

export default function DuplicateWarningDialog({
  candidate,
  warning,
  onClose,
  onOpenPrevious,
  onLink,
  onDismiss,
}) {
  return (
    <Modal title="Possible previous candidate found" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          {warning.matchType} · {warning.strength === "strong" ? "Strong match" : "Soft match"}
        </div>

        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="font-bold text-primary">Current candidate</dt>
            <dd className="text-secondary">{candidate.name || "-"}</dd>
          </div>
          <div>
            <dt className="font-bold text-primary">Previous candidate</dt>
            <dd className="text-secondary">{warning.candidate.name || "-"}</dd>
          </div>
          <div>
            <dt className="font-bold text-primary">Previous target bank</dt>
            <dd className="text-secondary">{warning.previousBank}</dd>
          </div>
          <div>
            <dt className="font-bold text-primary">Previous role</dt>
            <dd className="text-secondary">{warning.previousRole}</dd>
          </div>
          <div>
            <dt className="font-bold text-primary">Previous stage/outcome</dt>
            <dd className="text-secondary">{warning.previousStage}</dd>
          </div>
          <div>
            <dt className="font-bold text-primary">Previous recruiter</dt>
            <dd className="text-secondary">{warning.previousRecruiter}</dd>
          </div>
          <div>
            <dt className="font-bold text-primary">Previous activity date</dt>
            <dd className="text-secondary">{warning.previousActivityDate || "-"}</dd>
          </div>
          <div>
            <dt className="font-bold text-primary">Archived</dt>
            <dd className="text-secondary">{warning.isArchived ? "Yes" : "No"}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onOpenPrevious}
            className="action-button border border-app bg-surface text-secondary hover:bg-raised hover:text-primary"
          >
            Open previous record
          </button>
          <button
            type="button"
            onClick={onLink}
            className="action-button border border-app bg-surface text-secondary hover:bg-raised hover:text-primary"
          >
            Link records
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="action-button border border-app bg-surface text-secondary hover:bg-raised hover:text-primary"
          >
            Dismiss warning
          </button>
          <button
            type="button"
            onClick={onClose}
            className="action-button bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-400 dark:text-zinc-950"
          >
            Continue creating new application
          </button>
        </div>
      </div>
    </Modal>
  );
}
