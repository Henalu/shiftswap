import type { ShiftType } from "@/types";

interface ShiftSchedule {
  startTime: string;
  endTime: string;
}

export const SHIFT_TYPE_SCHEDULES = {
  morning: {
    startTime: "06:00",
    endTime: "14:00",
  },
  afternoon: {
    startTime: "14:00",
    endTime: "22:00",
  },
  night: {
    startTime: "22:00",
    endTime: "06:00",
  },
  normal_full: {
    startTime: "08:00",
    endTime: "16:00",
  },
  normal_short: {
    startTime: "08:00",
    endTime: "14:00",
  },
} as const satisfies Record<ShiftType, ShiftSchedule>;

export const SHIFT_TYPE_VALUES = Object.keys(
  SHIFT_TYPE_SCHEDULES,
) as ShiftType[];

export function normalizeShiftClock(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const [hours = "", minutes = "00"] = value.trim().split(":");
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
}

export function isShiftType(
  value: string | null | undefined,
): value is ShiftType {
  return SHIFT_TYPE_VALUES.includes(value as ShiftType);
}

export function isCompensationShiftType(
  value: string | null | undefined,
): value is ShiftType {
  return isShiftType(value);
}

export function getShiftSchedule(shiftType: ShiftType): ShiftSchedule {
  return SHIFT_TYPE_SCHEDULES[shiftType];
}

export function matchesShiftSchedule(
  shiftType: ShiftType,
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): boolean {
  const schedule = getShiftSchedule(shiftType);

  return (
    normalizeShiftClock(startTime) === schedule.startTime &&
    normalizeShiftClock(endTime) === schedule.endTime
  );
}

export function getClockMinutes(value: string | null | undefined): number | null {
  const normalized = normalizeShiftClock(value);
  const match = /^(\d{2}):(\d{2})$/.exec(normalized);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

export function getShiftDurationHours(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): number {
  const startMinutes = getClockMinutes(startTime);
  const endMinutes = getClockMinutes(endTime);

  if (startMinutes === null || endMinutes === null) {
    return 0;
  }

  const durationMinutes =
    endMinutes > startMinutes
      ? endMinutes - startMinutes
      : endMinutes + 24 * 60 - startMinutes;

  return durationMinutes / 60;
}

function formatClockMinutes(minutes: number): string {
  const normalizedMinutes = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalizedMinutes / 60);
  const mins = normalizedMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function getTimelineMinutes(
  value: string | null | undefined,
  shiftStartMinutes: number,
  wrapWhenEqual = false,
): number | null {
  const minutes = getClockMinutes(value);

  if (minutes === null) {
    return null;
  }

  if (minutes < shiftStartMinutes || (wrapWhenEqual && minutes === shiftStartMinutes)) {
    return minutes + 24 * 60;
  }

  return minutes;
}

export function getShiftHalfHourOptions(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): string[] {
  const startMinutes = getClockMinutes(startTime);
  const endMinutes = getClockMinutes(endTime);

  if (startMinutes === null || endMinutes === null) {
    return [];
  }

  const durationMinutes =
    endMinutes > startMinutes
      ? endMinutes - startMinutes
      : endMinutes + 24 * 60 - startMinutes;
  const options: string[] = [];

  for (let offset = 0; offset <= durationMinutes; offset += 30) {
    options.push(formatClockMinutes(startMinutes + offset));
  }

  return options;
}

export function validateShiftCoverageWindow({
  shiftStartTime,
  shiftEndTime,
  coverageStartTime,
  coverageEndTime,
}: {
  shiftStartTime: string | null | undefined;
  shiftEndTime: string | null | undefined;
  coverageStartTime: string | null | undefined;
  coverageEndTime: string | null | undefined;
}):
  | {
      valid: true;
      startTime: string;
      endTime: string;
      durationHours: number;
    }
  | {
      valid: false;
      reason: string;
    } {
  const shiftStartMinutes = getClockMinutes(shiftStartTime);
  const shiftEndMinutes = getClockMinutes(shiftEndTime);
  const coverageStartMinutes = getClockMinutes(coverageStartTime);
  const coverageEndMinutes = getClockMinutes(coverageEndTime);

  if (
    shiftStartMinutes === null ||
    shiftEndMinutes === null ||
    coverageStartMinutes === null ||
    coverageEndMinutes === null
  ) {
    return { valid: false, reason: "Selecciona horas validas para la cobertura parcial." };
  }

  if (coverageStartMinutes % 30 !== 0 || coverageEndMinutes % 30 !== 0) {
    return {
      valid: false,
      reason: "La cobertura parcial solo admite horas enteras o medias horas.",
    };
  }

  const shiftEndTimeline =
    shiftEndMinutes > shiftStartMinutes
      ? shiftEndMinutes
      : shiftEndMinutes + 24 * 60;
  const coverageStartTimeline = getTimelineMinutes(
    coverageStartTime,
    shiftStartMinutes,
  );
  const coverageEndTimeline = getTimelineMinutes(
    coverageEndTime,
    shiftStartMinutes,
    true,
  );

  if (coverageStartTimeline === null || coverageEndTimeline === null) {
    return { valid: false, reason: "Selecciona una franja valida." };
  }

  if (
    coverageStartTimeline < shiftStartMinutes ||
    coverageStartTimeline >= shiftEndTimeline ||
    coverageEndTimeline <= coverageStartTimeline ||
    coverageEndTimeline > shiftEndTimeline
  ) {
    return {
      valid: false,
      reason: "La cobertura parcial debe estar dentro del horario del turno.",
    };
  }

  return {
    valid: true,
    startTime: normalizeShiftClock(coverageStartTime),
    endTime: normalizeShiftClock(coverageEndTime),
    durationHours: (coverageEndTimeline - coverageStartTimeline) / 60,
  };
}

export function formatHoursQuantity(hours: number): string {
  const normalizedHours = Number.isFinite(hours) ? hours : 0;
  const value = Number.isInteger(normalizedHours)
    ? String(normalizedHours)
    : normalizedHours.toLocaleString("es-ES", {
        maximumFractionDigits: 1,
      });

  return `${value} hora${normalizedHours === 1 ? "" : "s"}`;
}
