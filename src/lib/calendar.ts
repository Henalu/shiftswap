import {
  CALENDAR_DAY_TYPE_LABELS,
  SHIFT_TYPE_LABELS,
} from "@/lib/constants";
import type {
  CalendarDayType,
  CalendarExchangeOverlayEntry,
  CalendarExchangeOverlayKind,
  ShiftType,
  ScheduleTypeCode,
} from "@/types";

// ============================================
// Types for calendar generation
// ============================================

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  dayType: CalendarDayType;
  isVacation: boolean;
  isOverride: boolean;
  exchangeOverlay: CalendarDayExchangeOverlay | null;
}

export interface CalendarDayExchangeOverlay {
  kind: CalendarExchangeOverlayKind;
  exchangeId: string;
  receivedShiftType: ShiftType | null;
  deliveredShiftType: ShiftType | null;
}

export interface CalendarInput {
  configured: true;
  scheduleType: ScheduleTypeCode;
  /** Only present for 3t5 schedules */
  rotation?: {
    sequence: string[];
    referenceDate: string; // YYYY-MM-DD
  };
  vacations: { start_date: string; end_date: string }[];
  overrides: { date: string; override_type: string }[];
}

export interface CalendarNotConfigured {
  configured: false;
}

export type CalendarConfig = CalendarInput | CalendarNotConfigured;

// ============================================
// Sequence letter → CalendarDayType
// ============================================

const SEQUENCE_MAP: Record<string, CalendarDayType> = {
  M: "morning",
  T: "afternoon",
  N: "night",
  D: "rest",
};

// ============================================
// Pure functions
// ============================================

/** Difference in days between two YYYY-MM-DD strings. */
function diffDays(a: string, b: string): number {
  const msA = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const msB = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((msB - msA) / 86_400_000);
}

/** ISO day of week: 1=Mon ... 7=Sun */
function isoDayOfWeek(dateStr: string): number {
  const d = new Date(
    +dateStr.slice(0, 4),
    +dateStr.slice(5, 7) - 1,
    +dateStr.slice(8, 10),
  );
  return d.getDay() === 0 ? 7 : d.getDay();
}

/**
 * Get the calendar day type for a 3T5 rotation on a specific date.
 * Uses modular arithmetic over the cycle length.
 */
export function get3T5DayType(
  targetDate: string,
  referenceDate: string,
  sequence: string[],
): CalendarDayType {
  const cycleLength = sequence.length;
  const daysDiff = diffDays(referenceDate, targetDate);
  // JS modulo can be negative for dates before reference — normalize
  const index = ((daysDiff % cycleLength) + cycleLength) % cycleLength;
  const letter = sequence[index];
  return SEQUENCE_MAP[letter] ?? "rest";
}

/**
 * Get the calendar day type for jornada normal.
 * Mon-Thu → normal_full, Fri → normal_short, Sat-Sun → rest.
 */
export function getNormalDayType(targetDate: string): CalendarDayType {
  const dow = isoDayOfWeek(targetDate);
  if (dow >= 1 && dow <= 4) return "normal_full";
  if (dow === 5) return "normal_short";
  return "rest";
}

/**
 * Check if a date falls within any vacation range.
 */
function isOnVacation(
  date: string,
  vacations: { start_date: string; end_date: string }[],
): boolean {
  return vacations.some((v) => date >= v.start_date && date <= v.end_date);
}

/**
 * Find an override for a specific date.
 */
function findOverride(
  date: string,
  overrides: { date: string; override_type: string }[],
): string | null {
  const match = overrides.find((o) => o.date === date);
  return match ? match.override_type : null;
}

/**
 * Add N days to a YYYY-MM-DD string.
 */
function addDays(dateStr: string, n: number): string {
  const d = new Date(
    +dateStr.slice(0, 4),
    +dateStr.slice(5, 7) - 1,
    +dateStr.slice(8, 10),
  );
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Generate a full calendar for a date range.
 * Applies: base schedule → overrides → vacations (vacation wins over all).
 */
export function generateCalendar(
  startDate: string,
  endDate: string,
  input: CalendarInput,
): CalendarDay[] {
  const days: CalendarDay[] = [];
  let current = startDate;

  while (current <= endDate) {
    // 1. Base day type from schedule
    let dayType: CalendarDayType;
    if (input.scheduleType === "3t5" && input.rotation) {
      dayType = get3T5DayType(
        current,
        input.rotation.referenceDate,
        input.rotation.sequence,
      );
    } else {
      dayType = getNormalDayType(current);
    }

    // 2. Override (admin exception)
    let isOverride = false;
    const overrideType = findOverride(current, input.overrides);
    if (overrideType) {
      dayType = overrideType as CalendarDayType;
      isOverride = true;
    }

    // 3. Vacation (wins over everything)
    const vacation = isOnVacation(current, input.vacations);
    if (vacation) {
      dayType = "vacation";
    }

    days.push({
      date: current,
      dayType,
      isVacation: vacation,
      isOverride,
      exchangeOverlay: null,
    });

    current = addDays(current, 1);
  }

  return days;
}

/**
 * Map CalendarDayType → ShiftType for work days.
 * Returns null for rest/vacation (not publishable).
 */
export function calendarDayTypeToShiftType(
  dayType: CalendarDayType,
): ShiftType | null {
  switch (dayType) {
    case "morning":
      return "morning";
    case "afternoon":
      return "afternoon";
    case "night":
      return "night";
    case "normal_full":
      return "normal_full";
    case "normal_short":
      return "normal_short";
    default:
      return null;
  }
}

/**
 * Map CalendarDayType → compensation_shift_type.
 * Work days keep their shift type, rest maps to "rest",
 * and vacations are not offerable.
 */
export function calendarDayTypeToCompensationShiftType(
  dayType: CalendarDayType,
): ShiftType | null {
  switch (dayType) {
    case "morning":
      return "morning";
    case "afternoon":
      return "afternoon";
    case "night":
      return "night";
    case "normal_full":
      return "normal_full";
    case "normal_short":
      return "normal_short";
    default:
      return null;
  }
}

export function mergeCalendarDaysWithExchangeOverlays(
  days: CalendarDay[],
  entries: CalendarExchangeOverlayEntry[],
): CalendarDay[] {
  if (entries.length === 0) {
    return days;
  }

  const overlayByDate = new Map<string, CalendarDayExchangeOverlay>();

  for (const entry of entries) {
    const current = overlayByDate.get(entry.date) ?? {
      kind: entry.kind,
      exchangeId: entry.exchangeId,
      receivedShiftType: null,
      deliveredShiftType: null,
    };

    if (entry.kind === "received") {
      current.receivedShiftType = entry.shiftType;
    } else {
      current.deliveredShiftType = entry.shiftType;
    }

    current.kind =
      current.receivedShiftType && current.deliveredShiftType
        ? "same_day_swap"
        : current.receivedShiftType
          ? "received"
          : "delivered";

    overlayByDate.set(entry.date, current);
  }

  return days.map((day) => ({
    ...day,
    exchangeOverlay: overlayByDate.get(day.date) ?? null,
  }));
}

export function getCalendarDayBlockedShiftTypes(
  day: CalendarDay | null | undefined,
): ShiftType[] {
  if (!day?.exchangeOverlay) {
    return [];
  }

  const blockedShiftTypes = new Set<ShiftType>();

  if (day.exchangeOverlay.receivedShiftType) {
    blockedShiftTypes.add(day.exchangeOverlay.receivedShiftType);
  }

  if (day.exchangeOverlay.deliveredShiftType) {
    blockedShiftTypes.add(day.exchangeOverlay.deliveredShiftType);
  }

  return [...blockedShiftTypes];
}

export function isShiftTypeBlockedByExchange(
  day: CalendarDay | null | undefined,
  shiftType: ShiftType,
): boolean {
  return getCalendarDayBlockedShiftTypes(day).includes(shiftType);
}

export function getCalendarDayBlockedShiftReason(
  day: CalendarDay | null | undefined,
  shiftType: ShiftType,
): "received" | "delivered" | null {
  if (!day?.exchangeOverlay) {
    return null;
  }

  if (day.exchangeOverlay.receivedShiftType === shiftType) {
    return "received";
  }

  if (day.exchangeOverlay.deliveredShiftType === shiftType) {
    return "delivered";
  }

  return null;
}

/**
 * Validate whether a user can publish/offer a shift on a given date.
 * Returns { valid: true } or { valid: false, reason: string }.
 */
export function isValidWorkDay(
  date: string,
  shiftType: ShiftType,
  config: CalendarConfig,
): { valid: true } | { valid: false; reason: string } {
  // Graceful degradation: no config → skip validation
  if (!config.configured) {
    return { valid: true };
  }

  const days = generateCalendar(date, date, config);
  const day = days[0];

  if (!day) {
    return { valid: true };
  }

  if (day.isVacation) {
    return {
      valid: false,
      reason: "Tienes vacaciones registradas para este dia.",
    };
  }

  if (day.dayType === "rest") {
    return {
      valid: false,
      reason: "No trabajas este dia segun tu calendario.",
    };
  }

  const expectedShiftType = calendarDayTypeToShiftType(day.dayType);
  if (expectedShiftType && expectedShiftType !== shiftType) {
    const expectedLabel = CALENDAR_DAY_TYPE_LABELS[day.dayType] ?? day.dayType;
    const actualLabel = SHIFT_TYPE_LABELS[shiftType] ?? shiftType;
    return {
      valid: false,
      reason: `Tu calendario indica turno de ${expectedLabel} para este dia, no ${actualLabel}.`,
    };
  }

  return { valid: true };
}

export function isValidCompensationDay(
  date: string,
  compensationShiftType: ShiftType,
  config: CalendarConfig,
): { valid: true } | { valid: false; reason: string } {
  if (!config.configured) {
    return { valid: true };
  }

  const days = generateCalendar(date, date, config);
  const day = days[0];

  if (!day) {
    return { valid: true };
  }

  if (day.isVacation) {
    return {
      valid: false,
      reason: "Tienes vacaciones registradas para este dia.",
    };
  }

  if (day.dayType === "rest") {
    return {
      valid: false,
      reason: "No puedes ofrecer un dia de descanso como cambio.",
    };
  }

  const expectedCompensationType = calendarDayTypeToCompensationShiftType(
    day.dayType,
  );

  if (!expectedCompensationType) {
    return {
      valid: false,
      reason: "Ese dia no puede ofrecerse como compensacion.",
    };
  }

  if (expectedCompensationType !== compensationShiftType) {
    const expectedLabel =
      SHIFT_TYPE_LABELS[expectedCompensationType] ?? day.dayType;
    const actualLabel =
      SHIFT_TYPE_LABELS[compensationShiftType] ?? compensationShiftType;
    return {
      valid: false,
      reason: `Tu calendario indica ${expectedLabel} para este dia, no ${actualLabel}.`,
    };
  }

  return { valid: true };
}

// ============================================
// Date helpers (exported for pages)
// ============================================

export function getMonthRange(
  year: number,
  month: number,
): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayISO(): string {
  return formatDateISO(new Date());
}
