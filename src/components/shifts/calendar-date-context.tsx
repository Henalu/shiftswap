"use client";

import { Badge } from "@/components/ui/badge";
import {
  CALENDAR_EXCHANGE_OVERLAY_LABELS,
  CALENDAR_EXCHANGE_OVERLAY_STYLES,
  CALENDAR_DAY_TYPE_LABELS,
  CALENDAR_DAY_TYPE_STYLES,
  SHIFT_TYPE_LABELS,
} from "@/lib/constants";
import type { CalendarDay } from "@/lib/calendar";
import { cn } from "@/lib/utils";

interface CalendarDateContextProps {
  day: CalendarDay;
  title: string;
  description: string;
  className?: string;
}

export function CalendarDateContext({
  day,
  title,
  description,
  className,
}: CalendarDateContextProps) {
  const exchangeOverlay = day.exchangeOverlay;
  const exchangeSummary = exchangeOverlay
    ? exchangeOverlay.kind === "same_day_swap"
      ? `Recibes ${exchangeOverlay.receivedShiftType ? SHIFT_TYPE_LABELS[exchangeOverlay.receivedShiftType] : "otro turno"} y cedes ${exchangeOverlay.deliveredShiftType ? SHIFT_TYPE_LABELS[exchangeOverlay.deliveredShiftType] : "tu turno original"}.`
      : exchangeOverlay.kind === "received"
        ? `Ese dia recibes ${exchangeOverlay.receivedShiftType ? SHIFT_TYPE_LABELS[exchangeOverlay.receivedShiftType] : "un turno intercambiado"}.`
        : `Ese dia has cedido ${exchangeOverlay.deliveredShiftType ? SHIFT_TYPE_LABELS[exchangeOverlay.deliveredShiftType] : "tu turno original"} a otra persona.`
    : null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-secondary/35 px-4 py-4",
        className
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <Badge className={cn("shrink-0", CALENDAR_DAY_TYPE_STYLES[day.dayType])}>
          {CALENDAR_DAY_TYPE_LABELS[day.dayType]}
        </Badge>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>

      {exchangeOverlay && exchangeSummary && (
        <div className="mt-3 flex flex-wrap items-start gap-3 border-t border-border/60 pt-3">
          <Badge
            className={cn(
              "shrink-0",
              CALENDAR_EXCHANGE_OVERLAY_STYLES[exchangeOverlay.kind],
            )}
          >
            {CALENDAR_EXCHANGE_OVERLAY_LABELS[exchangeOverlay.kind]}
          </Badge>
          <p className="min-w-0 text-sm leading-6 text-muted-foreground">
            {exchangeSummary}
          </p>
        </div>
      )}
    </div>
  );
}
