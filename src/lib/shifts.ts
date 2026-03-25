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
} as const satisfies Record<ShiftType, ShiftSchedule>;

export const SHIFT_TYPE_VALUES = Object.keys(
  SHIFT_TYPE_SCHEDULES
) as ShiftType[];

function normalizeShiftClock(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const [hours = "", minutes = "00"] = value.trim().split(":");
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
}

export function isShiftType(value: string | null | undefined): value is ShiftType {
  return SHIFT_TYPE_VALUES.includes(value as ShiftType);
}

export function getShiftSchedule(shiftType: ShiftType): ShiftSchedule {
  return SHIFT_TYPE_SCHEDULES[shiftType];
}

export function matchesShiftSchedule(
  shiftType: ShiftType,
  startTime: string | null | undefined,
  endTime: string | null | undefined
): boolean {
  const schedule = getShiftSchedule(shiftType);

  return (
    normalizeShiftClock(startTime) === schedule.startTime &&
    normalizeShiftClock(endTime) === schedule.endTime
  );
}
