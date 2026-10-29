/**
 * Shrink an uploaded image to a small square-ish data URL. Logos and avatars
 * are tiny, so they're stored inline on the row: no storage bucket to set up.
 */
export async function imageToDataUrl(file: File, max = 192): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("That file doesn't look like an image."));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const webp = canvas.toDataURL("image/webp", 0.85);
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const MAX_IMAGES = 6;
const MAX_FILE = 15 * 1024 * 1024;
/** Cards live in the database and load for everyone, so one card's pictures stay under about 700 KB. */
const MAX_CARD_CHARS = 950_000;

/** Shrink a picture for a card: up to 800px on the long side, saved as webp (or jpeg). */
export async function photoToDataUrl(file: File, max = 800): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error(`"${file.name}" couldn't be read as an image.`));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const webp = canvas.toDataURL("image/webp", 0.72);
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.72);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Add picked, dropped or pasted files to a card's pictures. Returns the new list and anything that was refused. */
export async function addPhotos(current: string[], files: File[]): Promise<{ images: string[]; problems: string[] }> {
  const images = [...current];
  const problems: string[] = [];
  let skipped = 0;
  for (const file of files) {
    if (images.length >= MAX_IMAGES) {
      skipped++;
      continue;
    }
    if (!file.type.startsWith("image/")) {
      problems.push(`"${file.name}" isn't an image.`);
      continue;
    }
    if (file.size > MAX_FILE) {
      problems.push(`"${file.name}" is over 15 MB. Pick a smaller one.`);
      continue;
    }
    try {
      const url = await photoToDataUrl(file);
      if (images.reduce((n, u) => n + u.length, url.length) > MAX_CARD_CHARS) problems.push("That's too much picture data for one card. Remove one first.");
      else images.push(url);
    } catch (e) {
      problems.push(e instanceof Error ? e.message : "That image didn't work.");
    }
  }
  if (skipped) problems.push(`A card holds ${MAX_IMAGES} pictures, so ${skipped} didn't fit.`);
  return { images, problems };
}
