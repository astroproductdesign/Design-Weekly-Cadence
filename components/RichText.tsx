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
  const out: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = (key: number) => {
    if (!bullets.length) return;
    out.push(
      <ul key={`ul${key}`}>
        {bullets.map((b, i) => (
          <li key={i}>{linkify(b)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };
  text.split("\n").forEach((line, i) => {
    if (BULLET.test(line)) bullets.push(line.replace(BULLET, ""));
    else {
      flush(i);
      if (line.trim()) out.push(<span key={i} style={{ display: "block" }}>{linkify(line)}</span>);
    }
  });
  flush(-1);
  return <>{out}</>;
}
