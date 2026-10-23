"use client";

import { useEffect } from "react";
import { Board } from "@/components/board/Board";
import { Filters } from "@/components/board/Filters";
import { PageHead } from "@/components/board/PageHead";
import { Present } from "@/components/board/Present";
import { Side } from "@/components/board/Side";
import { goToWeek } from "@/components/WeekNav";
import { currentSprintNumber, WEEKS_AHEAD } from "@/lib/sprint";
import { useStore } from "@/lib/store";
import { setUI, useUI } from "@/lib/ui-store";
import { cx } from "@/components/ui";

export default function BoardPage() {
  const present = useUI((s) => s.present);
  const sideCollapsed = useUI((s) => s.sideCollapsed);
  // Esc closes an open card or add-card form. ← → change week. ⌘P / Ctrl+P presents.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useUI.getState();
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        if (!s.settings) setUI({ present: !s.present, open: null, composer: null });
        return;
      }
      const typing = e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable], [role=combobox], [role=dialog], [role=listbox]");
      if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !typing && !s.present && !s.settings && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const { db, viewSprint } = useStore.getState();
        const current = currentSprintNumber();
        const n = viewSprint ?? current;
        const earliest = Math.min(current, ...Object.values(db.sprints).map((x) => x.number));
        const to = Math.max(earliest, Math.min(current + WEEKS_AHEAD, n + (e.key === "ArrowLeft" ? -1 : 1)));
        if (to !== n) {
          e.preventDefault();
          goToWeek(to, current);
        }
        return;
      }
      if (e.key === "Escape" && !e.defaultPrevented && !s.present && !s.settings && (s.open || s.composer)) setUI({ open: null, composer: null });
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div className={cx("wrap layout", sideCollapsed && "side-collapsed")}>
        <main className="mainp">
          <PageHead />
          <section className="board-surface reveal" style={{ ["--i" as string]: 1 }} aria-label="Board">
            <Filters />
            <Board />
          </section>
        </main>
        <Side />
      </div>
      {present && <Present />}
    </>
  );
}
