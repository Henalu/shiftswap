import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const SPANISH_LOCALE = "es-ES";

export const FORM_CONTROL_CLASSNAME =
  "flex h-11 w-full rounded-xl border border-border bg-background/90 px-3.5 text-sm text-foreground shadow-sm transition-[border-color,box-shadow,background-color] outline-none placeholder:text-muted-foreground/85 focus-visible:border-primary/45 focus-visible:bg-background focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60";

export const PANEL_CLASSNAME =
  "rounded-2xl border border-border/80 bg-card/96 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_18px_36px_-24px_rgba(15,23,42,0.18)]";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse a date string into a local Date. For date-only strings (YYYY-MM-DD),
 * forces local timezone to avoid the UTC-midnight shift that causes off-by-one
 * day errors in western timezones.
 */
function parseLocalDate(date: Date | string): Date {
  if (date instanceof Date) return date;
  // Date-only format: "2026-01-15" — parsed as UTC by spec, causing off-by-one
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(date);
}

export function formatDate(date: Date | string): string {
  const d = parseLocalDate(date);
  return d.toLocaleDateString(SPANISH_LOCALE, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatShortDate(date: Date | string): string {
  const d = parseLocalDate(date);
  return d.toLocaleDateString(SPANISH_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString(SPANISH_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeTime(
  date: Date | string,
  baseDate: Date = new Date()
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = d.getTime() - baseDate.getTime();
  const diffSec = Math.floor(Math.abs(diffMs) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  const rtf = new Intl.RelativeTimeFormat(SPANISH_LOCALE, { numeric: "auto" });
  const isPast = diffMs < 0;
  const sign = isPast ? -1 : 1;

  if (diffDay >= 1) return rtf.format(sign * diffDay, "day");
  if (diffHour >= 1) return rtf.format(sign * diffHour, "hour");
  if (diffMin >= 1) return rtf.format(sign * diffMin, "minute");
  return rtf.format(sign * diffSec, "second");
}

export function formatTimeRange(startTime: string, endTime: string): string {
  const formatClock = (value: string) => {
    if (!value.includes(":")) return value;
    const [hours, minutes] = value.split(":");
    return `${hours.padStart(2, "0")}:${(minutes ?? "00").padStart(2, "0")}`;
  };

  return `${formatClock(startTime)} - ${formatClock(endTime)}`;
}
