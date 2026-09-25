import { criterionMeta } from "./criteria";

export function humanize(value: string): string {
  const text = value.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function criterionLabel(key: string): string {
  return criterionMeta(key)?.label ?? humanize(key);
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

export type StatusTone = "neutral" | "accent" | "success" | "warning" | "danger";

export interface AttemptStatus {
  label: string;
  tone: StatusTone;
  action: string;
}

// Learner-facing wording for test states, so the UI never shows raw enums.
export function attemptStatus(state: string): AttemptStatus {
  switch (state) {
    case "COMPLETED":
      return { label: "Report ready", tone: "success", action: "View report" };
    case "SUBMITTED":
    case "PROCESSING":
      return { label: "Scoring", tone: "accent", action: "View status" };
    case "FAILED":
      return { label: "Scoring failed", tone: "danger", action: "View status" };
    case "CREATED":
    case "DEVICE_CHECK":
      return { label: "Not started", tone: "neutral", action: "Start" };
    case "EXPIRED":
      return { label: "Expired", tone: "neutral", action: "" };
    case "ABANDONED":
      return { label: "Abandoned", tone: "neutral", action: "" };
    case "DELETING":
    case "DELETED":
      return { label: "Deleted", tone: "neutral", action: "" };
    default:
      return { label: "In progress", tone: "warning", action: "Continue" };
  }
}

const BAND_DESCRIPTORS = [
  "Did not attempt",
  "Non-user",
  "Intermittent user",
  "Extremely limited user",
  "Limited user",
  "Modest user",
  "Competent user",
  "Good user",
  "Very good user",
  "Expert user",
];

// The public IELTS descriptor for the whole band at or below this score.
export function bandDescriptor(band: number | undefined | null): string | null {
  if (band === undefined || band === null || !Number.isFinite(band)) return null;
  return BAND_DESCRIPTORS[Math.max(0, Math.min(9, Math.floor(band)))];
}

export function confidenceText(value: string | undefined | null): string {
  if (!value) return "";
  return `${humanize(value.toLowerCase())} confidence`;
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

// Chart y-domain for band scores: start a band below the lowest value so
// half-band changes stay visible, but always end at 9.
export function bandDomain(values: (number | undefined | null)[]): [number, number] {
  const finite = values.filter((value): value is number => Number.isFinite(value));
  if (!finite.length) return [0, 9];
  const low = Math.max(0, Math.min(6, Math.floor(Math.min(...finite)) - 1));
  return [low, 9];
}
