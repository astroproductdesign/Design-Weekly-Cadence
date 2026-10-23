"use client";

import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cx } from "./ui";

const GAP = 8;
const EDGE = 8;
const HIDDEN: CSSProperties = { visibility: "hidden", top: 0, left: 0 };

/**
 * The DLS popover shell (radius-md, 1px border, shadow-3), rendered on top of
 * everything so lanes, drawers and sticky headers can't clip or cover it.
 * Opens 8px below its anchor and flips above when there's no room.
 */
export function Popover({
  anchor,
  onClose,
  children,
  className,
  matchWidth,
  label,
  role = "dialog",
}: {
  anchor: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** Exactly the anchor's width (DLS Dropdown panel). */
  matchWidth?: boolean;
  label?: string;
  role?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useLayoutEffect(() => {
    close.current = onClose;
  });

  useLayoutEffect(() => {
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      const p = panel.current;
      if (!a || !p) return;
      const w = matchWidth ? a.width : p.offsetWidth;
      const h = p.offsetHeight;
      let top = a.bottom + GAP;
      if (top + h > innerHeight - EDGE && a.top - GAP - h > EDGE) top = a.top - GAP - h;
      const left = Math.max(EDGE, Math.min(a.left, innerWidth - EDGE - w));
      Object.assign(p.style, { top: `${top}px`, left: `${left}px`, width: matchWidth ? `${a.width}px` : "", visibility: "visible" });
    };
    place();
    const ro = new ResizeObserver(place);
    if (panel.current) ro.observe(panel.current);
    addEventListener("scroll", place, true);
    addEventListener("resize", place);
    return () => {
      ro.disconnect();
      removeEventListener("scroll", place, true);
      removeEventListener("resize", place);
    };
  }, [anchor, matchWidth]);

  useEffect(() => {
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !anchor.current?.contains(t)) close.current();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [anchor]);

  // Portals still bubble through the React tree: keep clicks and keys in here
  // from reaching the card, composer or drawer that owns the field.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return createPortal(
    <div
      ref={panel}
      className={cx("c-pop", className)}
      style={HIDDEN}
      role={role}
      aria-label={label}
      onPointerDown={stop}
      onMouseDown={stop}
      onClick={stop}
      onKeyDown={stop}
    >
      {children}
    </div>,
    document.body,
  );
}
