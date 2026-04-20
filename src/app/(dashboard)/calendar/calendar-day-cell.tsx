"use client";

import { cn } from "@/lib/utils";
import {
  CALENDAR_EXCHANGE_OVERLAY_DOT_COLORS,
  CALENDAR_EXCHANGE_OVERLAY_LABELS,
  CALENDAR_EXCHANGE_OVERLAY_STYLES,
  CALENDAR_DAY_TYPE_LABELS,
  CALENDAR_DAY_TYPE_STYLES,
  CALENDAR_DAY_TYPE_DOT_COLORS,
  SHIFT_TYPE_LABELS,
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
  const exchangeOverlay = day.exchangeOverlay;
  const exchangeLabel = exchangeOverlay
    ? CALENDAR_EXCHANGE_OVERLAY_LABELS[exchangeOverlay.kind]
    : null;
  const exchangeDotColor = exchangeOverlay
    ? CALENDAR_EXCHANGE_OVERLAY_DOT_COLORS[exchangeOverlay.kind]
    : null;
  const exchangeSummary = exchangeOverlay
    ? exchangeOverlay.kind === "same_day_swap"
      ? `Recibes ${exchangeOverlay.receivedShiftType ? SHIFT_TYPE_LABELS[exchangeOverlay.receivedShiftType] : "otro turno"} y cedes ${exchangeOverlay.deliveredShiftType ? SHIFT_TYPE_LABELS[exchangeOverlay.deliveredShiftType] : "tu turno original"}`
      : exchangeOverlay.kind === "received"
        ? `Recibes ${exchangeOverlay.receivedShiftType ? SHIFT_TYPE_LABELS[exchangeOverlay.receivedShiftType] : "otro turno"}`
        : `Cedes ${exchangeOverlay.deliveredShiftType ? SHIFT_TYPE_LABELS[exchangeOverlay.deliveredShiftType] : "tu turno original"}`
    : null;

  return (
    <div
      className={cn(
        "group relative flex min-h-[3.5rem] flex-col items-center justify-center gap-1 rounded-xl border p-1.5 text-center transition-colors sm:min-h-[4.5rem] sm:items-start sm:justify-start sm:p-2",
        style,
        isToday && "ring-2 ring-primary ring-offset-1",
      )}
      aria-label={`${dayNum}, ${label}${exchangeLabel ? `, ${exchangeLabel.toLowerCase()}` : ""}${day.isOverride ? ", modificado por administrador" : ""}${isToday ? ", hoy" : ""}`}
    >
      <span
        className={cn(
          "text-xs font-semibold tabular-nums sm:text-sm",
          isToday && "text-primary",
        )}
      >
        {dayNum}
      </span>

      <div className="flex items-center gap-1 sm:hidden">
        <span
          className={cn("block size-2 rounded-full", dotColor)}
          aria-hidden="true"
        />
        {exchangeDotColor && (
          <span
            className={cn("block size-2 rounded-full", exchangeDotColor)}
            aria-hidden="true"
          />
        )}
      </div>

      <span className="hidden text-[10px] font-medium leading-tight sm:block">
        {label}
      </span>

      {exchangeOverlay && exchangeLabel && exchangeSummary && exchangeDotColor && (
        <div
          className={cn(
            "mt-auto hidden w-full rounded-lg border px-1.5 py-1 text-left sm:block",
            CALENDAR_EXCHANGE_OVERLAY_STYLES[exchangeOverlay.kind],
          )}
        >
          <div className="flex items-center gap-1">
            <span
              aria-hidden="true"
              className={cn("size-1.5 rounded-full", exchangeDotColor)}
            />
            <span className="text-[9px] font-semibold leading-tight">
              {exchangeLabel}
            </span>
          </div>
          <span className="mt-0.5 block text-[9px] leading-tight">
            {exchangeSummary}
          </span>
        </div>
      )}

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
