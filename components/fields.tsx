"use client";

import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { CalendarBlank, CaretDown, CaretLeft, CaretRight, Check, X } from "@phosphor-icons/react";
import { addDays, dayMs, isoFromMs, MONTH_NAMES, shortDate, todayKL } from "@/lib/sprint";
import { Popover } from "./Popover";
import { cx } from "./ui";

// DLS form controls: Dropdown (single select), a searchable variant for
// free-text fields with suggestions, and Date picker. Native <select> and
// <input type="date"> draw the browser's own UI, so they're not used.

export type Option<T extends string = string> = { value: T; label: string; lead?: ReactNode; hint?: string };
type Size = "sm" | "md";

/** Moves the highlighted row with the arrow keys; returns the new index. */
function step(e: KeyboardEvent, i: number, count: number): number | null {
  if (e.key === "ArrowDown") return Math.min(count - 1, i + 1);
  if (e.key === "ArrowUp") return Math.max(0, i - 1);
  if (e.key === "Home") return 0;
  if (e.key === "End") return count - 1;
  return null;
}

function Rows<T extends string>({ id, options, value, active, onPick, onHover }: { id: string; options: Option<T>[]; value: string; active: number; onPick: (v: T) => void; onHover: (i: number) => void }) {
  return (
    <ul className="c-dd-list" role="listbox" id={id}>
      {options.map((o, i) => (
        <li
          key={o.value}
          id={`${id}-${i}`}
          role="option"
          aria-selected={o.value === value}
          className={cx("c-dd-row", o.value === value && "selected", i === active && "active")}
          onPointerEnter={() => onHover(i)}
          // Keep focus on the field so picking doesn't count as leaving it.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(o.value)}
          ref={i === active ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}
        >
          {o.lead}
          <span className="c-dd-label">{o.label}</span>
          {o.hint && <span className="c-dd-hint">{o.hint}</span>}
          <Check className="c-dd-check" />
        </li>
      ))}
    </ul>
  );
}

/** DLS Dropdown, single select. Focus stays on the trigger; arrows move, Enter picks. */
export function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder = "Select",
  label,
  size = "md",
  borderless,
  className,
  style,
}: {
  value: T | "";
  onChange: (v: T) => void;
  options: Option<T>[];
  placeholder?: string;
  label: string;
  size?: Size;
  borderless?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = options.find((o) => o.value === value);

  const show = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const pick = (v: T) => {
    onChange(v);
    setOpen(false);
    trigger.current?.focus();
  };

  const onKey = (e: KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    const next = step(e, active, options.length);
    if (next != null) {
      e.preventDefault();
      setActive(next);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (options[active]) pick(options[active].value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === "Tab") setOpen(false);
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={cx("c-select", size, open && "open", selected && "filled", borderless && "borderless", className)}
        style={style}
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
      >
        {selected?.lead}
        <span className={cx("c-select-value", !selected && "ph")}>{selected?.label ?? placeholder}</span>
        <CaretDown className="c-select-chev" />
      </button>
      {open && (
        <Popover anchor={trigger} onClose={() => setOpen(false)} matchWidth role="presentation">
          <Rows id={id} options={options} value={value} active={active} onPick={pick} onHover={setActive} />
        </Popover>
      )}
    </>
  );
}

/**
 * DLS Dropdown, Multiple select: pick any number; the trigger summarises
 * ("Moon", then "3 selected") and the panel stays open across picks.
 */
export function MultiSelect<T extends string>({
  value,
  onChange,
  options,
  placeholder = "Select",
  label,
  size = "md",
  className,
  style,
}: {
  value: T[];
  onChange: (v: T[]) => void;
  options: Option<T>[];
  placeholder?: string;
  label: string;
  size?: Size;
  className?: string;
  style?: CSSProperties;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const chosen = options.filter((o) => value.includes(o.value));
  const summary = chosen.length === 0 ? placeholder : chosen.length === 1 ? chosen[0].label : `${chosen.length} selected`;
  const flip = (v: T) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  const onKey = (e: KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        setActive(0);
        setOpen(true);
      }
      return;
    }
    const next = step(e, active, options.length);
    if (next != null) {
      e.preventDefault();
      setActive(next);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (options[active]) flip(options[active].value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === "Tab") setOpen(false);
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        role="combobox"
        className={cx("c-select", size, open && "open", chosen.length > 0 && "filled", className)}
        style={style}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? setOpen(false) : (setActive(0), setOpen(true)))}
        onKeyDown={onKey}
      >
        {chosen.length === 1 && chosen[0].lead}
        <span className={cx("c-select-value", chosen.length === 0 && "ph")}>{summary}</span>
        <CaretDown className="c-select-chev" />
      </button>
      {open && (
        <Popover anchor={trigger} onClose={() => setOpen(false)} matchWidth role="presentation">
          <ul className="c-dd-list" role="listbox" aria-multiselectable id={id}>
            {options.map((o, i) => {
              const on = value.includes(o.value);
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={on}
                  className={cx("c-dd-row", i === active && "active")}
                  onPointerEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => flip(o.value)}
                >
                  <span className={cx("c-checkbox-box", on && "on")}>{on && <Check weight="bold" />}</span>
                  {o.lead}
                  <span className="c-dd-label">{o.label}</span>
                </li>
              );
            })}
          </ul>
          <div className="c-dd-foot">
            <button type="button" className="btn btn-ghost btn-sm" disabled={!value.length} onClick={() => onChange([])}>
              Clear
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </Popover>
      )}
    </>
  );
}

/**
 * DLS Dropdown, Searchable: a text field that suggests existing values as you
 * type but still accepts anything new.
 */
export function Combobox({
  value,
  onChange,
  suggestions,
  placeholder,
  label,
  size = "md",
  className,
  onBlur,
  chevron = true,
  invalid,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  /** Hide the dropdown arrow when the field is really a text box that only suggests. */
  chevron?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  suggestions: string[];
  placeholder?: string;
  label: string;
  size?: Size;
  className?: string;
}) {
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const q = value.trim().toLowerCase();
  const matches = suggestions.filter((s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q).slice(0, 8);
  const options = matches.map((s) => ({ value: s, label: s }));
  const showing = open && options.length > 0;

  return (
    <div ref={wrap} className={cx("c-select c-combo", size, showing && "open", value && "filled", invalid && "invalid", className)}>
      <input
        role="combobox"
        autoFocus={autoFocus}
        aria-invalid={invalid || undefined}
        aria-label={label}
        aria-expanded={showing}
        aria-controls={showing ? id : undefined}
        aria-autocomplete="list"
        aria-activedescendant={showing && active >= 0 ? `${id}-${active}` : undefined}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          // Suggestions show once you start typing, not as soon as the field is focused.
          setOpen(e.target.value.trim().length > 0);
          setActive(-1);
        }}
        onBlur={() => {
          setOpen(false);
          onBlur?.();
        }}
        onKeyDown={(e) => {
          if (!showing) {
            if (e.key === "ArrowDown") setOpen(true);
            return;
          }
          const next = step(e, active, options.length);
          if (next != null) {
            e.preventDefault();
            setActive(next);
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            onChange(options[active].value);
            setOpen(false);
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          } else if (e.key === "Tab") setOpen(false);
        }}
      />
      {chevron && <CaretDown className="c-select-chev" aria-hidden onClick={() => setOpen(!open)} />}
      {showing && (
        <Popover anchor={wrap} onClose={() => setOpen(false)} matchWidth role="presentation">
          <Rows
            id={id}
            options={options}
            value={value}
            active={active}
            onHover={setActive}
            onPick={(v) => {
              onChange(v);
              setOpen(false);
            }}
          />
        </Popover>
      )}
    </div>
  );
}

const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthStart(iso: string) {
  return `${iso.slice(0, 7)}-01`;
}
function addMonths(iso: string, n: number) {
  const d = new Date(dayMs(iso));
  return isoFromMs(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

/** DLS Date picker: calendar trigger + month grid popover. Today is outlined, the pick is filled. */
export function DatePicker({
  value,
  onChange,
  label,
  placeholder = "Pick a date",
  size = "md",
  clearable = true,
  near,
  className,
  style,
}: {
  value: string | null;
  /** Month to open on when there's no value yet (defaults to today). */
  near?: string;
  onChange: (v: string | null) => void;
  label: string;
  placeholder?: string;
  size?: Size;
  clearable?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const today = todayKL();
  const [focus, setFocus] = useState(value ?? today);
  const month = monthStart(focus);

  const show = () => {
    setFocus(value ?? near ?? today);
    setOpen(true);
    requestAnimationFrame(() => grid.current?.querySelector<HTMLElement>("[tabindex='0']")?.focus());
  };
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const moveTo = (iso: string) => {
    setFocus(iso);
    requestAnimationFrame(() => grid.current?.querySelector<HTMLElement>(`[data-day="${iso}"]`)?.focus());
  };

  // Monday-first grid covering the whole month.
  const lead = (new Date(dayMs(month)).getUTCDay() + 6) % 7;
  const first = addDays(month, -lead);
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i));
  const weeks = days[35].slice(0, 7) === month.slice(0, 7) ? 6 : 5;
  const m = new Date(dayMs(month));

  const onDayKey = (e: KeyboardEvent, iso: string) => {
    const delta: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (delta[e.key] != null) {
      e.preventDefault();
      moveTo(addDays(iso, delta[e.key]));
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const target = addMonths(iso, e.key === "PageUp" ? -1 : 1);
      moveTo(`${target.slice(0, 8)}${Math.min(Number(iso.slice(8)), 28).toString().padStart(2, "0")}`);
    }
  };

  return (
    <span className={cx("c-date", className)} style={style}>
      <button
        ref={trigger}
        type="button"
        className={cx("c-select", size, open && "open", value && "filled", value && clearable && "has-clear")}
        aria-label={value ? `${label}: ${shortDate(value)}` : label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : show())}
      >
        <CalendarBlank weight="fill" className="c-select-lead" />
        <span className={cx("c-select-value", !value && "ph")}>{value ? shortDate(value) : placeholder}</span>
        {!(value && clearable) && <CaretDown className="c-select-chev" />}
      </button>
      {value && clearable && (
        <button type="button" className="c-date-clear" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => onChange(null)}>
          <X />
        </button>
      )}
      {open && (
        <Popover anchor={trigger} onClose={() => setOpen(false)} label={label} className="c-datepicker">
          <div
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                close();
              }
            }}
          >
            <div className="c-dp-head">
              <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => setFocus(addMonths(month, -1))}>
                <CaretLeft />
              </button>
              <b aria-live="polite">
                {MONTH_NAMES[m.getUTCMonth()]} {m.getUTCFullYear()}
              </b>
              <button type="button" className="icon-btn" aria-label="Next month" onClick={() => setFocus(addMonths(month, 1))}>
                <CaretRight />
              </button>
            </div>
            <div className="c-dp-grid" role="grid" ref={grid}>
              {WD.map((d) => (
                <span key={d} className="c-dp-wd" role="columnheader">
                  {d.slice(0, 2)}
                </span>
              ))}
              {days.slice(0, weeks * 7).map((iso) => {
                const out = iso.slice(0, 7) !== month.slice(0, 7);
                return (
                  <button
                    key={iso}
                    type="button"
                    data-day={iso}
                    role="gridcell"
                    tabIndex={iso === focus ? 0 : -1}
                    disabled={out}
                    aria-selected={iso === value}
                    aria-current={iso === today ? "date" : undefined}
                    aria-label={shortDate(iso)}
                    className={cx("c-dp-day tab", iso === today && "today", iso === value && "selected", out && "out")}
                    onClick={() => {
                      onChange(iso);
                      close();
                    }}
                    onKeyDown={(e) => onDayKey(e, iso)}
                  >
                    {Number(iso.slice(8))}
                  </button>
                );
              })}
            </div>
          </div>
        </Popover>
      )}
    </span>
  );
}
