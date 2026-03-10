import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const SPANISH_LOCALE = 'es-ES';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(SPANISH_LOCALE, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatShortDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(SPANISH_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString(SPANISH_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(date: Date | string, baseDate: Date = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = d.getTime() - baseDate.getTime();
  const diffSec = Math.floor(Math.abs(diffMs) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  const rtf = new Intl.RelativeTimeFormat(SPANISH_LOCALE, { numeric: 'auto' });
  const isPast = diffMs < 0;
  const sign = isPast ? -1 : 1;

  if (diffDay >= 1) return rtf.format(sign * diffDay, 'day');
  if (diffHour >= 1) return rtf.format(sign * diffHour, 'hour');
  if (diffMin >= 1) return rtf.format(sign * diffMin, 'minute');
  return rtf.format(sign * diffSec, 'second');
}
