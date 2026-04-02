"use client";

import { cn } from "@/lib/utils";
import {
  CALENDAR_DAY_TYPE_LABELS,
  CALENDAR_DAY_TYPE_STYLES,
  CALENDAR_DAY_TYPE_DOT_COLORS,
} from "@/lib/constants";
import type { CalendarDay } from "@/lib/calendar";

interface CalendarDayCellProps {
  day: CalendarDay;
  isToday: boolean;
}

export function CalendarDayCell({ day, isToday }: CalendarDayCellProps) {
  const dayNum = parseInt(day.date.slice(8, 10), 10);
  const label = CALENDAR_DAY_TYPE_LABELS[day.dayType];
  const style = CALENDAR_DAY_TYPE_STYLES[day.dayType];
  const dotColor = CALENDAR_DAY_TYPE_DOT_COLORS[day.dayType];

  return (
    <div
      className={cn(
        "group relative flex min-h-[3.5rem] flex-col items-center justify-center gap-1 rounded-xl border p-1.5 text-center transition-colors sm:min-h-[4.5rem] sm:items-start sm:justify-start sm:p-2",
        style,
        isToday && "ring-2 ring-primary ring-offset-1"
      )}
      aria-label={`${dayNum}, ${label}${day.isOverride ? ", modificado por administrador" : ""}${isToday ? ", hoy" : ""}`}
    >
      <span
        className={cn(
          "text-xs font-semibold tabular-nums sm:text-sm",
          isToday && "text-primary"
        )}
      >
        {dayNum}
      </span>

      {/* Mobile: color dot only */}
      <span
        className={cn("block size-2 rounded-full sm:hidden", dotColor)}
        aria-hidden="true"
      />

      {/* Desktop: text label */}
      <span className="hidden text-[10px] font-medium leading-tight sm:block">
        {label}
      </span>

      {day.isOverride && (
        <>
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 size-1.5 rounded-full bg-amber-500"
          />
          <span className="sr-only">Modificado por administrador</span>
        </>
      )}
    </div>
  );
}
