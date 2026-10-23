"use client";

import { useRef, useState } from "react";
import { Check, SignOut } from "@phosphor-icons/react";
import { patchRow, setCurrentPerson } from "@/lib/store";
import type { Person } from "@/lib/types";
import { Blob, blobOf, BLOB_COLOR_NAMES, BLOB_COLORS } from "./Blob";
import { Popover } from "./Popover";
import { cx, firstName } from "./ui";

/** Top-bar person button: pick your blob's colour, or switch to someone else. */
export function MeMenu({ me }: { me: Person }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const current = blobOf(me.id, me.blob_color).color;

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={cx("me-btn", open && "open")}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Your profile"
        onClick={() => setOpen(!open)}
      >
        <Blob id={me.id} face size={30} />
        <span className="hide-sm">{firstName(me.name)}</span>
      </button>
      {open && (
        <Popover anchor={trigger} onClose={() => setOpen(false)} label="Your profile" className="c-me">
          <div className="me-pop" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
            <div className="me-pop-head">
              <Blob id={me.id} pose="wave" size={44} />
              <div>
                <b>{me.name}</b>
                <p className="meta">Pick your colour</p>
              </div>
            </div>
            <div className="me-swatches" role="radiogroup" aria-label="Your colour">
              {BLOB_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={current === c}
                  aria-label={BLOB_COLOR_NAMES[c]}
                  title={BLOB_COLOR_NAMES[c]}
                  className="me-swatch"
                  style={{ ["--sw" as string]: `var(--p-${c})` }}
                  onClick={() => patchRow("people", me.id, { blob_color: c })}
                >
                  {current === c && <Check weight="bold" />}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="me-switch"
              onClick={() => {
                setOpen(false);
                setCurrentPerson(null);
              }}
            >
              <SignOut /> Not you? Switch person
            </button>
          </div>
        </Popover>
      )}
    </>
  );
}
