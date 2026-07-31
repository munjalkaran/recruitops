import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function Modal({ title, description, children, onClose, size = "max-w-xl", footer, busy = false, variant = "centered" }) {
  const dialogRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocusedRef.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(dialogRef.current?.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex=\"-1\"])") || [])];
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);
  const modal = <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/45 px-4 py-6 backdrop-blur-md sm:py-10" style={{ WebkitBackdropFilter: "blur(14px)" }} onMouseDown={(event) => { if (!busy && !dialogRef.current?.contains(event.target)) onClose(); }}>
    <div className={variant === "drawer" ? "flex min-h-full justify-end" : "flex min-h-full items-center justify-center"}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="modal-title" className={`glass-modal flex w-full ${size} flex-col overflow-hidden border outline-none ${variant === "drawer" ? "min-h-[calc(100vh-3rem)] max-h-none rounded-none border-y-0 border-r-0 sm:min-h-[calc(100vh-5rem)]" : "mx-auto max-h-[calc(100vh-3rem)] rounded-2xl sm:max-h-[calc(100vh-5rem)]"}`}>
        <header className="glass-header sticky top-0 z-10 flex shrink-0 items-start justify-between border-b px-5 py-4">
        <div><h2 id="modal-title" className="text-base font-semibold text-primary">{title}</h2>{description ? <p className="mt-1 text-sm text-secondary">{description}</p> : null}</div>
        <button type="button" disabled={busy} onClick={onClose} className="rounded-lg p-2 text-secondary hover:bg-raised hover:text-primary disabled:opacity-50" aria-label="Close dialog"><X size={17} /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--glass-modal-body-bg)] px-5 py-5">{children}</div>
        {footer ? <footer className="glass-header sticky bottom-0 shrink-0 border-t px-5 py-4">{footer}</footer> : null}
      </div>
    </div>
  </div>;
  return createPortal(modal, document.body);
}
