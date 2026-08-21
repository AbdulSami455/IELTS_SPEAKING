export function humanize(value: string): string {
  const text = value.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function prettyState(state: string): string {
  return humanize(state).toLowerCase();
}

export function criterionLabel(key: string): string {
  return humanize(key);
}

export function partLabel(state: string): string {
  if (state === "PART1") return "Part 1 · Interview";
  if (state === "PART2_PREP") return "Part 2 · Preparation";
  if (state === "PART2_SPEAK") return "Part 2 · Long turn";
  if (state === "PART3") return "Part 3 · Discussion";
  if (state === "UPLOADING") return "Ready to finish";
  if (state === "READY") return "Ready to begin";
  return humanize(state);
}

export function packTitle(slug: string): string {
  return slug.replace(/-v\d+$/, "").replaceAll("-", " ");
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function bandText(band: number | undefined | null): string {
  if (band === undefined || band === null) return "—";
  return band.toFixed(1);
}
