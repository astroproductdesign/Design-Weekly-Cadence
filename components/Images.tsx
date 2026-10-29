"use client";

import { useEffect, useRef, useState } from "react";
import { CaretLeft, CaretRight, Plus, X } from "@phosphor-icons/react";
import { addPhotos, MAX_IMAGES } from "@/lib/image";
import { setUI, useUI } from "@/lib/ui-store";

export const openViewer = (images: string[], index: number) => setUI({ viewer: { images, index } });

/** Small thumbnails under a card's text. With more than `max`, the last tile reads "+N". */
export function ImageStrip({ images, max = 4 }: { images?: string[]; max?: number }) {
  if (!images?.length) return null;
  const shown = images.length > max ? max - 1 : images.length;
  return (
    <div className="strip">
      {images.slice(0, shown).map((src, i) => (
        <button key={i} type="button" className="thumb" aria-label={`Open picture ${i + 1} of ${images.length}`} onClick={() => openViewer(images, i)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" />
        </button>
      ))}
      {images.length > max && (
        <button type="button" className="thumb more" aria-label={`Open picture ${shown + 1}, and ${images.length - shown - 1} more`} onClick={() => openViewer(images, shown)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[shown]} alt="" />
          <span>+{images.length - shown}</span>
        </button>
      )}
    </div>
  );
}

/**
 * Add/remove pictures: a small "+ Add" tile, the thumbnails with an ×, and a 3/6 count.
 * `bind` hands back handlers so a whole form can accept dropped files and pasted screenshots.
 */
export function useImages(images: string[], onChange: (next: string[]) => void) {
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const latest = useRef(images);
  useEffect(() => {
    latest.current = images;
  }, [images]);

  const add = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    const r = await addPhotos(latest.current, files);
    setBusy(false);
    setProblem(r.problems.join(" "));
    if (r.images.length !== latest.current.length) onChange(r.images);
  };
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
  return {
    problem,
    busy,
    add,
    bind: {
      onPaste: (e: React.ClipboardEvent) => {
        const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
        if (files.length) {
          e.preventDefault();
          void add(files);
        }
      },
      onDragOver: (e: React.DragEvent) => hasFiles(e) && e.preventDefault(),
      onDrop: (e: React.DragEvent) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        void add(Array.from(e.dataTransfer.files));
      },
    },
  };
}

export function ImageRow({ images, onChange, imgs }: { images: string[]; onChange: (next: string[]) => void; imgs: ReturnType<typeof useImages> }) {
  const input = useRef<HTMLInputElement>(null);
  const full = images.length >= MAX_IMAGES;
  return (
    <>
      <div className="cimgs">
        {images.map((src, i) => (
          <div key={i} className="pic">
            <button type="button" className="pic-open" aria-label={`Open picture ${i + 1}`} onClick={() => openViewer(images, i)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" />
            </button>
            <button type="button" className="x" aria-label={`Remove picture ${i + 1}`} onClick={() => onChange(images.filter((_, k) => k !== i))}>
              <X weight="bold" />
            </button>
          </div>
        ))}
        {!full && (
          <button type="button" className="addtile" aria-label={`Add pictures, up to ${MAX_IMAGES}`} disabled={imgs.busy} onClick={() => input.current?.click()}>
            <Plus />
            <span>{imgs.busy ? "…" : "Add"}</span>
          </button>
        )}
        {images.length > 0 && <span className="hint tab">{images.length}/{MAX_IMAGES}</span>}
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void imgs.add(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>
      {imgs.problem && (
        <p className="field-error" role="alert">
          {imgs.problem}
        </p>
      )}
    </>
  );
}

/** Full-screen picture viewer: arrows, ← →, Esc. Sits above Present mode. */
export function ImageViewer() {
  const viewer = useUI((s) => s.viewer);
  const close = () => setUI({ viewer: null });
  const go = (d: number) => {
    const v = useUI.getState().viewer;
    if (v) setUI({ viewer: { ...v, index: (v.index + d + v.images.length) % v.images.length } });
  };
  const open = !!viewer;
  useEffect(() => {
    if (!open) return;
    // Capture phase: Esc and the arrows belong to the viewer, not the board or Present mode behind it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.stopImmediatePropagation();
      e.preventDefault();
      if (e.key === "Escape") close();
      else go(e.key === "ArrowLeft" ? -1 : 1);
    };
    addEventListener("keydown", onKey, true);
    return () => removeEventListener("keydown", onKey, true);
  }, [open]);
  if (!viewer) return null;
  const many = viewer.images.length > 1;
  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label="Pictures" onClick={(e) => e.target === e.currentTarget && close()}>
      <button type="button" className="viewer-btn viewer-close" aria-label="Close" autoFocus onClick={close}>
        <X />
      </button>
      {many && (
        <button type="button" className="viewer-btn viewer-prev" aria-label="Previous picture" onClick={() => go(-1)}>
          <CaretLeft />
        </button>
      )}
      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={viewer.images[viewer.index]} alt={`Picture ${viewer.index + 1}`} />
        <figcaption className="tab">
          {viewer.index + 1} / {viewer.images.length}
        </figcaption>
      </figure>
      {many && (
        <button type="button" className="viewer-btn viewer-next" aria-label="Next picture" onClick={() => go(1)}>
          <CaretRight />
        </button>
      )}
    </div>
  );
}
