import type { ProjectColor } from "./types";

// Project colours (Collabrium accents). Each key maps to a --p-<key>
// variable in globals.css, shown as the band on the side of cards.
export const PROJECT_COLORS: { key: ProjectColor; label: string }[] = [
  { key: "amber", label: "Yellow" },
  { key: "navy", label: "Blue" },
  { key: "purple", label: "Purple" },
  { key: "salmon", label: "Pink" },
  { key: "turquoise", label: "Teal" },
  { key: "orange", label: "Orange" },
  { key: "green", label: "Green" },
  { key: "grey", label: "Grey" },
  { key: "neutral", label: "None" },
];
