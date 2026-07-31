import Modal from "./Modal";

export default function ConfirmationDialog({
  title,
  message,
  confirmLabel,
  confirming = false,
  destructive = false,
  error = "",
  onCancel,
  onConfirm,
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      busy={confirming}
      size="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={confirming}
            className="action-button border border-app bg-surface text-secondary hover:bg-raised disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className={`action-button text-white disabled:cursor-not-allowed disabled:opacity-50 ${
              destructive ? "bg-rose-600 hover:bg-rose-700" : "action-primary"
            }`}
          >
            {confirming ? "Working..." : error ? "Retry" : confirmLabel}
          </button>
        </div>
      }
    >
      <p className="text-sm leading-6 text-secondary">{message}</p>
      {error ? <div role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm leading-5 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">{error}</div> : null}
    </Modal>
  );
}
