// Collabrium "blob" characters: one soft squircle, two dot eyes, one tick
// brow, a curved smile, thin noodle limbs, one ground line. Used on the
// welcome page, the top bar and the page greeting.

"use client";

import { useStore } from "@/lib/store";
import type { ProjectColor } from "@/lib/types";

export const BLOB_COLORS: ProjectColor[] = ["orange", "green", "purple", "turquoise", "navy", "salmon", "amber"];
export const BLOB_COLOR_NAMES: Record<string, string> = { orange: "Orange", green: "Green", purple: "Purple", turquoise: "Turquoise", navy: "Blue", salmon: "Pink", amber: "Yellow" };

/** Per-person face variant, and the character colour unless they picked their own. */
export function blobOf(id: string, picked?: ProjectColor | null) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return { color: picked && BLOB_COLORS.includes(picked) ? picked : BLOB_COLORS[h % BLOB_COLORS.length], v: h };
}

export function Blob({
  id,
  pose = "idle",
  size = 96,
  face = false,
  className = "",
}: {
  id: string;
  pose?: "idle" | "wave" | "cheer";
  size?: number;
  face?: boolean;
  className?: string;
}) {
  const picked = useStore((s) => s.db.people[id]?.blob_color);
  const lead = useStore((s) => s.db.people[id]?.role === "lead");
  const { color, v } = blobOf(id, picked);
  const ink = "var(--blob-ink)";
  const fill = `var(--p-${color})`;
  const line = { stroke: ink, strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" } as const;
  const browLeft = v % 2 === 0;
  const eyeY = 35 + (v % 3);

  if (face) {
    return (
      <svg className={`blob ${className}`} viewBox="16 10 68 64" width={size} height={size} aria-hidden style={{ flex: "none", overflow: "visible" }}>
        <rect x="18" y="12" width="64" height="60" rx="26" fill={fill} />
        {lead && <path d="M36 14 l-2 -11 l10 7 l6 -9 l6 9 l10 -7 l-2 11 z" fill="var(--p-amber)" stroke={ink} strokeWidth={2.4} strokeLinejoin="round" />}
        <circle cx="42" cy={eyeY + 4} r="3.4" fill={ink} />
        <circle cx="58" cy={eyeY + 4} r="3.4" fill={ink} />
        <path d={browLeft ? "M36 31 l9 -2" : "M55 29 l9 2"} {...line} strokeWidth={3} />
        <path d={v % 3 === 1 ? "M42 50 Q50 58 58 50" : "M44 50 Q50 55 56 50"} {...line} strokeWidth={3} />
      </svg>
    );
  }

  const hand = (x: number) => `M${x} 20 l-4 -5 M${x} 20 l0 -7 M${x} 20 l4 -5`;
  const arms = {
    idle: ["M22 50 C14 58 14 66 18 72", "M78 50 C86 58 86 66 82 72"],
    wave: ["M22 50 C14 58 14 66 18 72", `M78 46 C90 40 92 30 89 20 ${hand(89)}`],
    cheer: [`M22 46 C10 40 8 30 11 20 ${hand(11)}`, `M78 46 C90 40 92 30 89 20 ${hand(89)}`],
  }[pose];

  return (
    <svg
      className={`blob ${className}`}
      viewBox="0 0 100 124"
      width={size}
      height={size * 1.24}
      aria-hidden
      style={{ overflow: "visible", flex: "none" }}
    >
      {pose === "cheer" && (
        <>
          <path d="M4 8 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="var(--p-amber)" />
          <path d="M95 6 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6z" fill="var(--p-salmon)" />
        </>
      )}
      <path d={arms[0]} {...line} />
      <path d={arms[1]} {...line} />
      <path d="M42 72 C41 86 45 96 40 110 M40 110 h-8 M58 72 C59 86 55 96 60 110 M60 110 h8" {...line} />
      <rect x="20" y="14" width="60" height="60" rx="25" fill={fill} />
      {lead && (
        <path d="M34 15 l-2 -14 l12 8 l6 -11 l6 11 l12 -8 l-2 14 z" fill="var(--p-amber)" stroke={ink} strokeWidth={2.2} strokeLinejoin="round" />
      )}
      <circle cx="43" cy={eyeY} r="2.8" fill={ink} />
      <circle cx="57" cy={eyeY} r="2.8" fill={ink} />
      <path d={browLeft ? "M38 28 l7 -1.6" : "M55 26.4 l7 1.6"} {...line} />
      <path d={pose === "cheer" || v % 3 === 1 ? "M43 44 Q50 52 57 44" : "M44.5 44 Q50 49 55.5 44"} {...line} />
      <path d="M24 114 H76" {...line} strokeWidth={1.8} />
    </svg>
  );
}
