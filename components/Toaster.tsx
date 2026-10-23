"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { ArrowCounterClockwise } from "@phosphor-icons/react";

type Toast = { id: number; message: string; undo?: () => void };

const useToasts = create<{ toast: Toast | null }>(() => ({ toast: null }));

/** Show a short message, optionally with an Undo button (used instead of confirm dialogs). */
export function showToast(message: string, undo?: () => void) {
  useToasts.setState({ toast: { id: Date.now(), message, undo } });
}

export function Toaster() {
  const toast = useToasts((s) => s.toast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => useToasts.setState({ toast: null }), toast.undo ? 6000 : 2800);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  return (
    <div className="toast" role="status" key={toast.id}>
      {toast.message}
      {toast.undo && (
        <button
          type="button"
          onClick={() => {
            toast.undo!();
            useToasts.setState({ toast: null });
          }}
        >
          <ArrowCounterClockwise weight="bold" /> Undo
        </button>
      )}
    </div>
  );
}
