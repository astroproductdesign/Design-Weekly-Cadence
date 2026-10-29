"use client";

import { create } from "zustand";
import type { Col } from "./board";

// View state for the board (not saved to the database).
type UIState = {
  group: "project" | "person";
  persons: string[];
  projects: string[];
  flags: string[];
  q: string;
  /** Card whose editor is open. */
  open: string | null;
  /** Where the add-card form is open: lane = project id (or person id when grouped by person). */
  composer: { lane: string; col: Col; task?: string } | null;
  collapsed: Record<string, boolean>;
  settings: boolean;
  present: boolean;
  /** Important date being edited ("new" for the add form). */
  dateForm: string | null;
  /** Card just added (plays a small pop-in). */
  fresh: string | null;
  /** Cards someone else just added (pop in as they arrive). */
  arrived: Record<string, true>;
  /** Picture viewer: a card's images and which one is showing. */
  viewer: { images: string[]; index: number } | null;
  /** Right-hand panel folded down to a slim rail (remembered per device). */
  sideCollapsed: boolean;
};

const SIDE_KEY = "cadence-side-collapsed";

function readSide() {
  try {
    return typeof window !== "undefined" && localStorage.getItem(SIDE_KEY) === "1";
  } catch {
    return false;
  }
}

export const useUI = create<UIState>(() => ({
  group: "project",
  persons: [],
  projects: [],
  flags: [],
  q: "",
  open: null,
  composer: null,
  collapsed: {},
  settings: false,
  present: false,
  dateForm: null,
  fresh: null,
  arrived: {},
  viewer: null,
  sideCollapsed: readSide(),
}));

export const setUI = (patch: Partial<UIState>) => useUI.setState(patch);

export function setSideCollapsed(v: boolean) {
  try {
    localStorage.setItem(SIDE_KEY, v ? "1" : "0");
  } catch {}
  setUI({ sideCollapsed: v });
}

export const isFiltering = (s: UIState) => !!(s.persons.length || s.projects.length || s.flags.length || s.q.trim());
