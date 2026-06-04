"use client";

import { useActionState, useMemo, useState } from "react";
import { CalendarDateContext } from "@/components/shifts/calendar-date-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CALENDAR_DAY_TYPE_LABELS,
  SHIFT_TYPE_LABELS,
} from "@/lib/constants";
import {
  calendarDayTypeToShiftType,
  getCalendarDayBlockedShiftReason,
  type CalendarDay,
} from "@/lib/calendar";
import { getShiftSchedule, isShiftType } from "@/lib/shifts";
import { formatTimeRange, FORM_CONTROL_CLASSNAME } from "@/lib/utils";
import type { ShiftType } from "@/types";
import { createShift } from "./actions";
import { ShiftDatePicker } from "./shift-date-picker";

interface ShiftFormProps {
  areaName: string;
  departmentName: string;
  calendarDays?: CalendarDay[] | null;
  initialDate?: string;
  initialShiftType?: ShiftType | null;
}

export function ShiftForm({
  areaName,
  departmentName,
  calendarDays,
  initialDate = "",
  initialShiftType = null,
}: ShiftFormProps) {
  const [state, formAction] = useActionState(createShift, {});
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedShiftType, setSelectedShiftType] = useState<ShiftType | "">(
    initialShiftType ?? "",
  );

  // Build a lookup map for calendar hints
  const calendarMap = useMemo(() => {
    if (!calendarDays) return null;
    const map = new Map<string, CalendarDay>();
    for (const day of calendarDays) {
      map.set(day.date, day);
    }
    return map;
  }, [calendarDays]);

  // When date changes, auto-select shift type from calendar
  const calendarHint = calendarMap?.get(selectedDate) ?? null;
  const calendarWarning = calendarHint
    ? calendarHint.dayType === "rest"
      ? "No trabajas este dia segun tu calendario."
      : calendarHint.isVacation
        ? "Tienes vacaciones registradas para este dia."
        : null
    : null;
  const calendarOutOfRangeWarning =
    calendarMap && selectedDate && !calendarHint
      ? "No hemos podido anticipar esa fecha con el calendario cargado."
      : null;
  const exchangeLockReason =
    calendarHint && selectedShiftType
      ? getCalendarDayBlockedShiftReason(calendarHint, selectedShiftType)
      : null;
  const exchangeLockWarning =
    exchangeLockReason === "received"
      ? "Ese turno ya lo has recibido mediante un intercambio activo y no puede publicarse de nuevo."
      : exchangeLockReason === "delivered"
        ? "Ese turno ya lo has cedido en un intercambio activo y no puede volver a publicarse."
        : null;
  const isCalendarControlledDate = Boolean(calendarHint);
  const isPublishBlockedByCalendar = Boolean(
    (calendarHint && calendarWarning) || exchangeLockWarning,
  );
  const selectedSchedule = selectedShiftType
    ? getShiftSchedule(selectedShiftType)
    : null;

  return (
    <form action={formAction}>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Detalles del turno</CardTitle>
          <CardDescription>
            Cuanto mas claro sea este formulario, mas facil sera que otra persona
            compare tu turno y tome una decision rapido.
          </CardDescription>
          <div className="rounded-2xl border border-border/70 bg-secondary/45 px-4 py-3 text-sm text-muted-foreground">
            Este turno se publicara dentro de{" "}
            <span className="font-semibold text-foreground">{departmentName}</span>
            {areaName !== departmentName ? (
              <>
                {" "}
                en el area{" "}
                <span className="font-semibold text-foreground">{areaName}</span>
              </>
            ) : null}
            .
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {state?.error && (
            <p className="rounded-2xl border border-destructive/15 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {state.error}
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date">Fecha</Label>
              <ShiftDatePicker
                id="date"
                name="date"
                value={selectedDate}
                calendarDays={calendarDays}
                onChange={(date) => {
                  setSelectedDate(date);
                  if (calendarMap) {
                    const day = calendarMap.get(date);
                    if (day) {
                      const shiftType = calendarDayTypeToShiftType(day.dayType);
                      setSelectedShiftType(shiftType ?? "");
                    } else {
                      setSelectedShiftType("");
                    }
                  }
                }}
              />
              {calendarHint && calendarWarning && (
                <CalendarDateContext
                  day={calendarHint}
                  title="Fecha no publicable"
                  description={calendarWarning}
                />
              )}
              {calendarHint && !calendarWarning && exchangeLockWarning && (
                <CalendarDateContext
                  day={calendarHint}
                  title="Turno ya comprometido"
                  description={exchangeLockWarning}
                />
              )}
              {calendarHint && !calendarWarning && !exchangeLockWarning && (
                <CalendarDateContext
                  day={calendarHint}
                  title="Asignacion detectada"
                  description={`Tu calendario marca ${CALENDAR_DAY_TYPE_LABELS[calendarHint.dayType].toLowerCase()} para este dia. El tipo de turno y el horario se asignaran automaticamente.`}
                />
              )}
              {calendarOutOfRangeWarning && (
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  {calendarOutOfRangeWarning}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="shift_type">Tipo de turno</Label>
              {calendarHint && !calendarWarning && (
                <input type="hidden" name="shift_type" value={selectedShiftType} />
              )}
              <select
                id="shift_type"
                name={calendarHint && !calendarWarning ? undefined : isCalendarControlledDate ? undefined : "shift_type"}
                required={!isCalendarControlledDate}
                value={selectedShiftType}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setSelectedShiftType(isShiftType(nextValue) ? nextValue : "");
                }}
                className={FORM_CONTROL_CLASSNAME}
                aria-describedby="shift-schedule-help shift-schedule-current"
                disabled={isCalendarControlledDate}
              >
                <option value="">Selecciona un tipo</option>
                {(Object.entries(SHIFT_TYPE_LABELS) as [ShiftType, string][]).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  )
                )}
              </select>
              {calendarHint && !calendarWarning && (
                <p className="text-xs text-muted-foreground">
                  Tipo asignado por tu calendario: {CALENDAR_DAY_TYPE_LABELS[calendarHint.dayType]}.
                </p>
              )}
            </div>
          </div>

          <div
            id="shift-schedule-help"
            className="rounded-2xl border border-border/70 bg-secondary/40 px-4 py-3 text-sm"
          >
            <p className="font-medium text-foreground">
              El horario se asigna automaticamente segun el tipo de turno.
            </p>
            <p className="mt-1 text-muted-foreground">
              Mañana 06:00-14:00, Tarde 14:00-22:00, Noche 22:00-06:00, J. completa 08:00-16:00, J. reducida 08:00-14:00.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start_time">Hora de inicio</Label>
              <Input
                id="start_time"
                name="start_time"
                type="time"
                required
                readOnly
                value={selectedSchedule?.startTime ?? ""}
                className="bg-muted/45"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_time">Hora de fin</Label>
              <Input
                id="end_time"
                name="end_time"
                type="time"
                required
                readOnly
                value={selectedSchedule?.endTime ?? ""}
                className="bg-muted/45"
              />
            </div>
          </div>

          <p id="shift-schedule-current" className="text-sm text-muted-foreground">
            {selectedSchedule
              ? `Horario asignado: ${formatTimeRange(
                  selectedSchedule.startTime,
                  selectedSchedule.endTime
                )}.`
              : "Selecciona primero el tipo de turno para ver el horario que se publicara."}
          </p>

          <div className="space-y-3">
            <Label>Modalidades aceptadas</Label>
            <p className="text-sm text-muted-foreground">
              Elige que tipo de propuestas quieres recibir para este turno.
            </p>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="accepted_modalities"
                  value="hours_bank"
                  defaultChecked
                  className="size-4 rounded border-border"
                />
                Bolsa de horas
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="accepted_modalities"
                  value="shift_exchange"
                  defaultChecked
                  className="size-4 rounded border-border"
                />
                Intercambio de turno
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Notas opcionales</Label>
            <textarea
              id="description"
              name="description"
              rows={4}
              placeholder="Añade solo el contexto que ayude a valorar el intercambio."
              className={FORM_CONTROL_CLASSNAME + " min-h-28 py-3"}
            />
            <p className="text-sm text-muted-foreground">
              Añade solo el contexto que ayude a valorar el intercambio, como una
              restriccion puntual o una preferencia de compensacion.
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex flex-wrap justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            El turno se publicara listo para recibir propuestas.
          </p>
          <Button type="submit" disabled={isPublishBlockedByCalendar}>
            Publicar turno
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
