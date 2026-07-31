import { useCallback, useEffect, useRef } from "react";

export default function useDismissibleSurface(open, onClose, { returnFocus = true, closeOnScroll = false } = {}) {
  const surfaceRef = useRef(null);
  const triggerRef = useRef(null);
  const close = useCallback(() => {
    onClose?.();
    if (returnFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, [onClose, returnFocus]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!surfaceRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) close();
    };
    const onKeyDown = (event) => { if (event.key === "Escape") { event.preventDefault(); close(); } };
    const onScroll = () => closeOnScroll && close();
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [close, closeOnScroll, open]);

  return { surfaceRef, triggerRef, close };
}
