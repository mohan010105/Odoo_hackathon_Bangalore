/**
 * Single source of truth for leave business rules.
 *
 * The same day-count rule exists in the database (`leave_calendar_days`), so
 * changing the policy means changing it here and in that SQL function only —
 * never inside a component.
 */

export const LEAVE_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

/** Maximum span of a single request, in days. Mirrors the database guard. */
export const MAX_LEAVE_SPAN_DAYS = 91;

/** Attachment rules for leave certificates. */
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "doc", "docx"] as const;
export const ATTACHMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.doc,.docx";
export const LEAVE_ATTACHMENT_BUCKET = "leave-attachments";

/**
 * Total leave days for an inclusive date range.
 *
 * Phase 4 policy: every calendar day counts, weekends included. Dates are plain
 * `yyyy-mm-dd` strings and are never routed through UTC timestamps, so a date
 * cannot shift by a day in another browser timezone.
 */
export function leaveDays(start: string, end: string): number {
  if (!isIsoDate(start) || !isIsoDate(end) || end < start) return 0;
  return Math.round((dateValue(end) - dateValue(start)) / 86_400_000) + 1;
}

export function isIsoDate(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dateValue(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day);
}

/** Human-readable leave date, e.g. "22 Aug 2026". Timezone-safe. */
export function formatLeaveDate(iso: string | null | undefined): string {
  if (!isIsoDate(iso)) return "—";
  const [year, month, day] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Formats a day count for display, trimming trailing zeros. */
export function formatDays(value: number | string | null | undefined): string {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "0";
  return numeric.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

/** Validates a chosen attachment before upload. Returns an error message or null. */
export function validateAttachment(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ATTACHMENT_EXTENSIONS.includes(extension as (typeof ATTACHMENT_EXTENSIONS)[number])) {
    return "Upload a PDF, JPG, PNG or Word document.";
  }
  if (file.size > ATTACHMENT_MAX_BYTES) return "That file is larger than 10 MB.";
  return null;
}

/** Preset ranges for admin filters, resolved against the business date. */
export function presetRange(
  preset: "TODAY" | "WEEK" | "MONTH",
  today: string,
): { from: string; to: string } {
  const [year, month, day] = today.split("-").map(Number) as [number, number, number];
  const base = new Date(Date.UTC(year, month - 1, day));

  if (preset === "TODAY") return { from: today, to: today };

  if (preset === "WEEK") {
    const weekday = (base.getUTCDay() + 6) % 7; // Monday = 0
    const start = new Date(base);
    start.setUTCDate(base.getUTCDate() - weekday);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    return { from: toIso(start), to: toIso(end) };
  }

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { from: toIso(start), to: toIso(end) };
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}
