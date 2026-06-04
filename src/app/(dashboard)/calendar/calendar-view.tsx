"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ShiftForm } from "@/app/(dashboard)/shifts/new/shift-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, PANEL_CLASSNAME } from "@/lib/utils";
import {
  CALENDAR_EXCHANGE_OVERLAY_DOT_COLORS,
  CALENDAR_EXCHANGE_OVERLAY_LABELS,
  CALENDAR_DAY_TYPE_LABELS,
  CALENDAR_DAY_TYPE_DOT_COLORS,
  CALENDAR_PUBLICATION_MARKER_DOT_COLORS,
  CALENDAR_PUBLICATION_MARKER_LABELS,
} from "@/lib/constants";
import {
  calendarDayTypeToShiftType,
  type CalendarDay,
} from "@/lib/calendar";
import type { CalendarDayType, CalendarExchangeOverlayKind } from "@/types";
import { CalendarDayCell } from "@/app/(dashboard)/calendar/calendar-day-cell";

const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];
const WEEKDAY_FULL_LABELS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];

const LEGEND_ITEMS: CalendarDayType[] = [
  "morning",
  "afternoon",
  "night",
  "normal_full",
  "normal_short",
  "rest",
  "vacation",
];
const EXCHANGE_LEGEND_ITEMS: CalendarExchangeOverlayKind[] = [
  "received",
  "delivered",
  "same_day_swap",
];

export interface CalendarPublicationMarker {
  date: string;
  mineCount: number;
  otherCount: number;
  boardHref: string;
}

const EMPTY_PUBLICATION_MARKERS: CalendarPublicationMarker[] = [];

interface CalendarViewProps {
  days: CalendarDay[];
  monthLabel: string;
  today: string;
  prevMonth: string;
  nextMonth: string;
  year: number;
  month: number;
  publicationScope?: {
    areaName: string;
    departmentName: string;
  } | null;
  publicationMarkers?: CalendarPublicationMarker[];
}

export function CalendarView({
  days,
  monthLabel,
  today,
  prevMonth,
  nextMonth,
  year,
  month,
  publicationScope = null,
  publicationMarkers = EMPTY_PUBLICATION_MARKERS,
}: CalendarViewProps) {
  const [publishDay, setPublishDay] = useState<CalendarDay | null>(null);
  const publicationMarkerByDate = useMemo(
    () =>
      new Map(
        publicationMarkers.map((marker) => [marker.date, marker] as const)
      ),
    [publicationMarkers]
  );
  const hasMyPublicationMarkers = publicationMarkers.some(
    (marker) => marker.mineCount > 0
  );
  const hasOtherPublicationMarkers = publicationMarkers.some(
    (marker) => marker.otherCount > 0
  );
  // Calculate offset: what day of the week is the 1st?
  // ISO: Mon=1 ... Sun=7
  const firstDate = new Date(year, month - 1, 1);
  const firstDow = firstDate.getDay() === 0 ? 7 : firstDate.getDay();
  const leadingBlanks = firstDow - 1;

  // Filter legend to only show day types present in this month
  const presentTypes = new Set(days.map((d) => d.dayType));
  const activeLegend = LEGEND_ITEMS.filter((t) => presentTypes.has(t));
  const presentExchangeTypes = new Set(
    days
      .map((day) => day.exchangeOverlay?.kind)
      .filter((kind): kind is CalendarExchangeOverlayKind => Boolean(kind)),
  );
  const activeExchangeLegend = EXCHANGE_LEGEND_ITEMS.filter((kind) =>
    presentExchangeTypes.has(kind),
  );

  const publishShiftType = publishDay
    ? calendarDayTypeToShiftType(publishDay.dayType)
    : null;

  return (
    <>
    <div className={cn(PANEL_CLASSNAME, "overflow-hidden")}>
      {/* Header with month navigation */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 sm:px-6">
        <Button asChild variant="ghost" size="icon" className="size-8 min-h-11 min-w-11">
          <Link href={`/calendar?month=${prevMonth}`} aria-label="Mes anterior">
            <ChevronLeft className="size-4" />
          </Link>
        </Button>
        <h2 className="text-sm font-semibold capitalize tracking-[-0.01em] text-foreground sm:text-base">
          {monthLabel}
        </h2>
        <Button asChild variant="ghost" size="icon" className="size-8 min-h-11 min-w-11">
          <Link href={`/calendar?month=${nextMonth}`} aria-label="Mes siguiente">
            <ChevronRight className="size-4" />
          </Link>
        </Button>
      </div>

      {/* Calendar grid with ARIA table semantics */}
      <div role="grid" aria-label={monthLabel} className="gap-px bg-border/30 p-px">
        {/* Weekday header row */}
        <div role="row" className="grid grid-cols-7 border-b border-border/40 bg-muted/30">
          {WEEKDAY_LABELS.map((label, i) => (
            <div
              key={label}
              role="columnheader"
              aria-label={WEEKDAY_FULL_LABELS[i]}
              className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Day cells grouped by week */}
        {(() => {
          const allCells: (CalendarDay | null)[] = [
            ...Array.from({ length: leadingBlanks }, () => null),
            ...days,
            ...Array.from(
              { length: (7 - ((leadingBlanks + days.length) % 7)) % 7 },
              () => null
            ),
          ];
          const weeks: (CalendarDay | null)[][] = [];
          for (let i = 0; i < allCells.length; i += 7) {
            weeks.push(allCells.slice(i, i + 7));
          }
          return weeks.map((week, wi) => (
            <div key={wi} role="row" className="grid grid-cols-7 gap-px">
              {week.map((day, di) => {
                if (!day) {
                  return (
                    <div
                      key={`empty-${wi}-${di}`}
                      role="gridcell"
                      aria-hidden="true"
                      className="min-h-[3.5rem] bg-background sm:min-h-[4.5rem]"
                    />
                  );
                }

                const publicationMarker = publicationMarkerByDate.get(day.date);

                return (
                  <div key={day.date} role="gridcell" className="bg-background">
                    <CalendarDayCell
                      day={day}
                      isToday={day.date === today}
                      onPublish={
                        publicationScope && day.date >= today
                          ? () => setPublishDay(day)
                          : undefined
                      }
                      publicationMarker={publicationMarker}
                      boardHref={publicationMarker?.boardHref}
                    />
                  </div>
                );
              })}
            </div>
          ));
        })()}
      </div>

      {/* Legend */}
      {(activeLegend.length > 0 ||
        activeExchangeLegend.length > 0 ||
        hasMyPublicationMarkers ||
        hasOtherPublicationMarkers) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border/40 px-4 py-3 sm:px-6">
          {activeLegend.map((type) => (
            <div key={type} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn(
                  "size-2.5 rounded-full",
                  CALENDAR_DAY_TYPE_DOT_COLORS[type]
                )}
              />
              <span className="text-[11px] text-muted-foreground">
                {CALENDAR_DAY_TYPE_LABELS[type]}
              </span>
            </div>
          ))}
          {activeExchangeLegend.map((type) => (
            <div key={type} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn(
                  "size-2.5 rounded-full",
                  CALENDAR_EXCHANGE_OVERLAY_DOT_COLORS[type],
                )}
              />
              <span className="text-[11px] text-muted-foreground">
                {CALENDAR_EXCHANGE_OVERLAY_LABELS[type]}
              </span>
            </div>
          ))}
          {hasMyPublicationMarkers && (
            <div className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn(
                  "size-2.5 rounded-full",
                  CALENDAR_PUBLICATION_MARKER_DOT_COLORS.mine
                )}
              />
              <span className="text-[11px] text-muted-foreground">
                {CALENDAR_PUBLICATION_MARKER_LABELS.mine}
              </span>
            </div>
          )}
          {hasOtherPublicationMarkers && (
            <div className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn(
                  "size-2.5 rounded-full",
                  CALENDAR_PUBLICATION_MARKER_DOT_COLORS.other
                )}
              />
              <span className="text-[11px] text-muted-foreground">
                {CALENDAR_PUBLICATION_MARKER_LABELS.other}
              </span>
            </div>
          )}
        </div>
      )}
    </div>

    <Dialog
      open={Boolean(publishDay)}
      onOpenChange={(open) => {
        if (!open) {
          setPublishDay(null);
        }
      }}
    >
      <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto border-0 bg-transparent p-0 shadow-none sm:rounded-xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Publicar turno desde calendario</DialogTitle>
          <DialogDescription>
            Formulario de publicacion con la fecha y el turno del calendario
            precargados.
          </DialogDescription>
        </DialogHeader>
        {publishDay && publicationScope && (
          <ShiftForm
            key={publishDay.date}
            areaName={publicationScope.areaName}
            departmentName={publicationScope.departmentName}
            calendarDays={days}
            initialDate={publishDay.date}
            initialShiftType={publishShiftType}
          />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
