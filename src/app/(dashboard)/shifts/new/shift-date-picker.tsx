"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CALENDAR_DAY_TYPE_LABELS,
  CALENDAR_DAY_TYPE_STYLES,
  SHIFT_TYPE_LABELS,
} from "@/lib/constants";
import {
  calendarDayTypeToShiftType,
  formatDateISO,
  type CalendarDay,
} from "@/lib/calendar";
import { cn, formatShortDate } from "@/lib/utils";

const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

interface ShiftDatePickerProps {
  id: string;
  name: string;
  value: string;
  calendarDays?: CalendarDay[] | null;
  minDate?: string;
  dialogLabel?: string;
  emptyLabel?: string;
  onChange: (date: string) => void;
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function getMadridToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getMonthLabel(monthDate: Date): string {
  return monthDate.toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });
}

function getMonthCells(monthDate: Date): Array<{ date: string; inMonth: boolean }> {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDate = new Date(year, month, 1);
  const firstDow = firstDate.getDay() === 0 ? 7 : firstDate.getDay();
  const leadingBlanks = firstDow - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ date: string; inMonth: boolean }> = [];

  for (let offset = leadingBlanks; offset > 0; offset -= 1) {
    const date = new Date(year, month, 1 - offset);
    cells.push({ date: formatDateISO(date), inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: formatDateISO(new Date(year, month, day)), inMonth: true });
  }

  const trailingCells = (7 - (cells.length % 7)) % 7;
  for (let day = 1; day <= trailingCells; day += 1) {
    cells.push({ date: formatDateISO(new Date(year, month + 1, day)), inMonth: false });
  }

  return cells;
}

function getDayLabel(day: CalendarDay | null | undefined): string {
  if (!day) {
    return "Sin calendario";
  }

  if (day.isVacation) {
    return "Vacaciones";
  }

  const shiftType = calendarDayTypeToShiftType(day.dayType);
  return shiftType ? SHIFT_TYPE_LABELS[shiftType] : CALENDAR_DAY_TYPE_LABELS[day.dayType];
}

export function ShiftDatePicker({
  id,
  name,
  value,
  calendarDays,
  minDate,
  dialogLabel,
  emptyLabel,
  onChange,
}: ShiftDatePickerProps) {
  const [open, setOpen] = useState(false);
  const today = useMemo(() => getMadridToday(), []);
  const minimumSelectableDate = minDate ?? today;
  const selectedDate = parseDate(value);
  const [visibleMonth, setVisibleMonth] = useState<Date>(
    selectedDate ?? parseDate(minimumSelectableDate) ?? new Date(),
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const calendarMap = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const day of calendarDays ?? []) {
      map.set(day.date, day);
    }
    return map;
  }, [calendarDays]);

  const selectedDay = value ? calendarMap.get(value) : null;
  const monthCells = useMemo(() => getMonthCells(visibleMonth), [visibleMonth]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <input id={id} name={name} type="hidden" value={value} required />
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full justify-between px-3.5 text-left font-medium"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={cn("truncate", !value && "text-muted-foreground")}>
          {value ? formatShortDate(value) : emptyLabel ?? "Selecciona una fecha"}
        </span>
        <CalendarIcon className="size-4 text-muted-foreground" />
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label={dialogLabel ?? "Seleccionar fecha del turno"}
          className="absolute left-1/2 top-[calc(100%+0.5rem)] z-40 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-border bg-background p-3 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.45)] sm:left-0 sm:translate-x-0"
        >
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Mes anterior"
              onClick={() =>
                setVisibleMonth(
                  (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1),
                )
              }
            >
              <ChevronLeft className="size-4" />
            </Button>
            <p className="text-sm font-semibold capitalize text-foreground">
              {getMonthLabel(visibleMonth)}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Mes siguiente"
              onClick={() =>
                setVisibleMonth(
                  (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1),
                )
              }
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center">
            {WEEKDAY_LABELS.map((label) => (
              <span
                key={label}
                className="py-1 text-[11px] font-semibold text-muted-foreground"
              >
                {label}
              </span>
            ))}
            {monthCells.map((cell) => {
              const day = calendarMap.get(cell.date);
              const isBeforeMinimum = cell.date < minimumSelectableDate;
              const isSelected = cell.date === value;
              const isToday = cell.date === today;
              const isBlocked =
                Boolean(day?.isVacation) ||
                day?.dayType === "rest" ||
                Boolean(day?.exchangeOverlay);
              const label = getDayLabel(day);

              return (
                <button
                  key={cell.date}
                  type="button"
                  disabled={isBeforeMinimum}
                  title={`${formatShortDate(cell.date)} - ${label}`}
                  aria-label={`${formatShortDate(cell.date)}, ${label}`}
                  onClick={() => {
                    onChange(cell.date);
                    setOpen(false);
                  }}
                  className={cn(
                    "relative flex aspect-square min-h-9 items-center justify-center rounded-xl border text-sm font-semibold tabular-nums transition-colors",
                    cell.inMonth
                      ? "border-border/60 bg-background text-foreground"
                      : "border-transparent bg-transparent text-muted-foreground/55",
                    day && cell.inMonth && CALENDAR_DAY_TYPE_STYLES[day.dayType],
                    isBlocked && "opacity-70",
                    isToday && "ring-2 ring-primary/45 ring-offset-1",
                    isSelected && "border-primary bg-primary text-primary-foreground ring-2 ring-primary/25 ring-offset-1",
                    isBeforeMinimum && "cursor-not-allowed opacity-35",
                    !isBeforeMinimum &&
                      !isSelected &&
                      "hover:border-primary/45 hover:bg-secondary",
                  )}
                >
                  {Number(cell.date.slice(8, 10))}
                  {day?.exchangeOverlay && (
                    <span
                      aria-hidden="true"
                      className="absolute right-1 top-1 size-1.5 rounded-full bg-rose-500"
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
            {calendarDays ? (
              [
                "morning",
                "afternoon",
                "night",
                "normal_full",
                "normal_short",
                "rest",
                "vacation",
              ].map((type) => (
                <span
                  key={type}
                  className={cn(
                    "rounded-full border px-2 py-1 text-[10px] font-semibold",
                    CALENDAR_DAY_TYPE_STYLES[type as CalendarDay["dayType"]],
                  )}
                >
                  {CALENDAR_DAY_TYPE_LABELS[type as CalendarDay["dayType"]]}
                </span>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">
                Sin calendario cargado para colorear los turnos.
              </span>
            )}
          </div>

          {selectedDay && (
            <p className="mt-3 rounded-xl border border-border/70 bg-secondary/35 px-3 py-2 text-xs text-muted-foreground">
              Seleccionado:{" "}
              <span className="font-semibold text-foreground">
                {getDayLabel(selectedDay)}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
