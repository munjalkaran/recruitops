export default function Modal({ title, description, children, onClose, size = "max-w-xl" }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className={`max-h-[90vh] w-full ${size} overflow-auto rounded-lg border border-app bg-surface shadow-xl`}>
        <div className="flex items-start justify-between border-b border-app px-5 py-4">
          <div>
            <h2 id="modal-title" className="text-base font-extrabold text-primary">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm text-secondary">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xl leading-none text-secondary hover:bg-raised hover:text-primary"
            aria-label="Close dialog"
          >
            x
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
