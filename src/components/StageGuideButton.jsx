import { createPortal } from "react-dom";
import { useLayoutEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import { PIPELINE_STAGES, STAGE_DEFINITIONS } from "../constants/pipeline";
import useDismissibleSurface from "../hooks/useDismissibleSurface";

export default function StageGuideButton() {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const { surfaceRef, triggerRef } = useDismissibleSurface(open, () => setOpen(false), { closeOnScroll: true });

  useLayoutEffect(() => {
    if (!open) return undefined;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(420, window.innerWidth - 32);
      setPosition({
        top: rect.bottom + 8,
        left: Math.max(16, Math.min(rect.right - width, window.innerWidth - width - 16)),
        width,
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [open, triggerRef]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        title="Stage guide"
        aria-label="Stage guide"
        className="glass-control inline-flex h-8 w-8 items-center justify-center rounded-full border border-app transition"
        aria-expanded={open}
      >
        <HelpCircle size={14} />
      </button>
      {open && position && typeof document !== "undefined" ? createPortal(
        <div ref={surfaceRef} style={{ top: position.top, left: position.left, width: position.width }} className="glass-menu fixed z-[90] max-h-[min(70vh,560px)] overflow-y-auto rounded-lg border p-4">
          <p className="mb-3 text-sm font-semibold text-primary">Pipeline stages</p>
          <div className="space-y-3">
            {PIPELINE_STAGES.map((stage) => (
              <div key={stage}>
                <p className="text-sm font-bold text-primary">{stage}</p>
                <p className="text-xs leading-5 text-secondary">{STAGE_DEFINITIONS[stage]}</p>
              </div>
            ))}
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
