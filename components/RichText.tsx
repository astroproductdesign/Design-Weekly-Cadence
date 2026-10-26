import { Fragment, type ReactNode } from "react";

// Tiny formatter for notes: "- " lines become bullets, URLs become links.
// Everything else is plain text (no HTML).

const LINK = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

function linkify(text: string): ReactNode[] {
  return text.split(LINK).map((part, i) =>
    i % 2 ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
        {part.replace(/^https?:\/\/(www\.)?/, "").slice(0, 30)}
        {part.length > 40 ? "…" : ""}
      </a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

const BULLET = /^\s*[-*•]\s+/;

export function RichText({ text }: { text: string }) {
  // Blank lines the writer typed are kept as spacing (leading and trailing ones are dropped).
  type Item = { kind: "gap" } | { kind: "line"; node: ReactNode } | { kind: "list"; items: string[] };
  const items: Item[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) items.push({ kind: "list", items: bullets });
    bullets = [];
  };
  text.split("\n").forEach((line) => {
    if (BULLET.test(line)) bullets.push(line.replace(BULLET, ""));
    else {
      flush();
      items.push(line.trim() ? { kind: "line", node: linkify(line) } : { kind: "gap" });
    }
  });
  flush();
  while (items.length && items[0].kind === "gap") items.shift();
  while (items.length && items[items.length - 1].kind === "gap") items.pop();
  return (
    <>
      {items.map((it, i) =>
        it.kind === "gap" ? (
          <span key={i} className="rt-gap" aria-hidden />
        ) : it.kind === "list" ? (
          <ul key={i}>
            {it.items.map((b, j) => (
              <li key={j}>{linkify(b)}</li>
            ))}
          </ul>
        ) : (
          <span key={i} className="rt-line">
            {it.node}
          </span>
        ),
      )}
    </>
  );
}
