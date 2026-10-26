"use client";

import type { CSSProperties } from "react";
import { CalendarBlank, CheckCircle, CircleHalf, Clock, Prohibit, type Icon } from "@phosphor-icons/react";
import type { Col } from "@/lib/board";
import { dayMonth, dueState, relativeDay } from "@/lib/sprint";
import type { Person, Project, ProjectColor, Size } from "@/lib/types";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export const SIZE_HELP = "S = under a day · M = a few days · L = most of the week or more";

/** Sets --pc to a project's colour (used by card bands, dots and dates). */
export function pc(color: ProjectColor | null | undefined): CSSProperties {
  return { "--pc": `var(--p-${color ?? "neutral"})` } as CSSProperties;
}

export function initials(name: string) {
  const w = name.trim().split(/\s+/);
  return ((w[0]?.[0] ?? "") + (w.length > 1 ? w[w.length - 1][0] : "")).toUpperCase();
}

export function firstName(name: string | undefined) {
  return (name ?? "").split(" ")[0];
}

/** Circle with initials (or the uploaded photo). */
export function Avatar({ person, size = 22 }: { person: Pick<Person, "name" | "avatar_url"> | null | undefined; size?: number }) {
  if (!person) return null;
  return (
    <span className="av" title={person.name} style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.38)) }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {person.avatar_url ? <img src={person.avatar_url} alt="" /> : initials(person.name)}
    </span>
  );
}

/** No logo yet: initials for multi-word names ("AH"), short words whole ("KULT"), else two letters ("CO"). */
export function logoText(p: Pick<Project, "name" | "short_name">) {
  const w = (p.short_name || p.name).replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  if (!w.length) return "?";
  return (w.length > 1 ? w.slice(0, 3).map((x) => x[0]).join("") : w[0].length <= 4 ? w[0] : w[0].slice(0, 2)).toUpperCase();
}

/** Colours whose avatar text must be white to stay readable. */
const LIGHT_INK = new Set(["navy", "purple", "grey"]);

export function Logo({ project, size = 32, icon: IconCmp }: { project?: Project | null; size?: number; icon?: Icon }) {
  const style = { width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.3)) };
  if (IconCmp || !project) {
    const C = IconCmp ?? CalendarBlank;
    return (
      <span className="logo" style={style} aria-hidden>
        <C />
      </span>
    );
  }
  const tinted = !!project.color && project.color !== "neutral";
  return (
    <span className={cx("logo", tinted && "tint")} data-ink={LIGHT_INK.has(project.color) ? "light" : undefined} style={tinted ? { ...style, ...pc(project.color) } : style} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {project.logo_url ? <img src={project.logo_url} alt="" /> : logoText(project)}
    </span>
  );
}

const COL_ICON: Record<Col, { C: Icon; color: string }> = {
  done: { C: CheckCircle, color: "var(--ok)" },
  doing: { C: CircleHalf, color: "var(--info)" },
  blocked: { C: Prohibit, color: "var(--danger)" },
};

export function ColIcon({ col, size = 20 }: { col: Col; size?: number }) {
  const { C, color } = COL_ICON[col];
  return (
    <span className="ico" style={{ color, fontSize: size }} aria-hidden>
      <C weight="fill" />
    </span>
  );
}

export function DueChip({ due, done }: { due: string | null; done?: boolean }) {
  if (!due) return null;
  const st = done ? "later" : dueState(due);
  return (
    <span className={cx("due", st)} title={`Due ${relativeDay(due)}`}>
      <Clock />
      {st === "overdue" ? "Overdue " : ""}
      {dayMonth(due)}
    </span>
  );
}

const SIZE_N: Record<Size, number> = { S: 1, M: 2, L: 3 };
const SIZE_NAME: Record<Size, string> = { S: "Small", M: "Medium", L: "Large" };
const SIZE_EFFORT: Record<Size, string> = { S: "Under a day of effort", M: "A few days of effort", L: "Most of the week or more" };
export const sizeTip = (s: Size) => `${SIZE_NAME[s]} task\n${SIZE_EFFORT[s]}`;

/** Three dots, filled up to the size: ● ○ ○ small, ● ● ○ medium, ● ● ● large. */
export function SizeDots({ size }: { size: Size }) {
  return (
    <span className="size-dots" role="img" aria-label={`${SIZE_NAME[size]}: ${SIZE_EFFORT[size]}`} data-tip={sizeTip(size)} tabIndex={0}>
      {[1, 2, 3].map((i) => (
        <i key={i} className={i <= SIZE_N[size] ? "on" : ""} />
      ))}
    </span>
  );
}

export function Sizes({ value, onChange }: { value: Size | null; onChange: (s: Size | null) => void }) {
  return (
    <span className="sizes" role="radiogroup" aria-label="Size (optional)">
      {(["S", "M", "L"] as Size[]).map((s) => (
        <button key={s} type="button" role="radio" aria-checked={value === s} aria-label={`${SIZE_NAME[s]}: ${SIZE_EFFORT[s]}`} data-tip={sizeTip(s)} onClick={() => onChange(value === s ? null : s)}>
          {s}
        </button>
      ))}
    </span>
  );
}
