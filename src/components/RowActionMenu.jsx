import { MoreHorizontal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MENU_WIDTH = 224;
const VIEWPORT_GUTTER = 12;

function getMenuPosition(button, itemCount) {
  const rect = button.getBoundingClientRect();
  const menuHeight = Math.max(44, itemCount * 38 + 12);
  const spaceBelow = window.innerHeight - rect.bottom;
  const opensUp = spaceBelow < menuHeight + VIEWPORT_GUTTER && rect.top > menuHeight;
  const top = opensUp
    ? Math.max(VIEWPORT_GUTTER, rect.top - menuHeight - 6)
    : Math.min(window.innerHeight - menuHeight - VIEWPORT_GUTTER, rect.bottom + 6);
  const left = Math.min(
    Math.max(VIEWPORT_GUTTER, rect.left),
    window.innerWidth - MENU_WIDTH - VIEWPORT_GUTTER,
  );

  return { left, top: Math.max(VIEWPORT_GUTTER, top), opensUp };
}

export default function RowActionMenu({ label, items }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  const enabledItems = items.filter(Boolean);
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    setPosition(getMenuPosition(buttonRef.current, enabledItems.length));
  }, [enabledItems.length]);

  useEffect(() => {
    if (!open) return undefined;
    updatePosition();

    const closeOnOutside = (event) => {
      if (buttonRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const buttons = Array.from(menuRef.current?.querySelectorAll("button:not(:disabled)") || []);
        if (!buttons.length) return;
        const currentIndex = buttons.indexOf(document.activeElement);
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + direction + buttons.length) % buttons.length;
        buttons[nextIndex]?.focus();
      }
    };

    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (open && position) menuRef.current?.querySelector("button")?.focus();
  }, [open, position]);

  if (!enabledItems.length) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-app bg-surface text-secondary transition hover:bg-raised hover:text-primary"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title="More"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className="glass-menu fixed z-[70] w-56 rounded-lg border p-1.5 text-sm shadow-lg outline-none"
              style={{ left: position.left, top: position.top }}
            >
              {enabledItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  className={`row-menu-item ${item.destructive ? "text-rose-600 dark:text-rose-300" : ""}`}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                    buttonRef.current?.focus();
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
