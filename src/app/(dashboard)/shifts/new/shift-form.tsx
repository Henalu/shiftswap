"use client";

import { useActionState, useMemo, useState } from "react";
import { CalendarDateContext } from "@/components/shifts/calendar-date-context";
import { ShiftPublicationScopeFields } from "@/components/shifts/shift-publication-scope-fields";
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
import {
  formatHoursQuantity,
  getShiftHalfHourOptions,
  getShiftSchedule,
  isShiftType,
  validateShiftCoverageWindow,
} from "@/lib/shifts";
import { formatTimeRange, FORM_CONTROL_CLASSNAME } from "@/lib/utils";
import type { AcceptedModality, Department, JobPosition, ShiftType } from "@/types";
import { createShift } from "./actions";
import { ShiftDatePicker } from "./shift-date-picker";

interface ShiftFormProps {
  departments: Department[];
  jobPositions: JobPosition[];
  defaultDepartmentId: string;
  defaultJobPositionId?: string | null;
  calendarDays?: CalendarDay[] | null;
  initialDate?: string;
  initialShiftType?: ShiftType | null;
}

export function ShiftForm({
  departments,
  jobPositions,
  defaultDepartmentId,
  defaultJobPositionId = null,
  calendarDays,
  initialDate = "",
  initialShiftType = null,
}: ShiftFormProps) {
  const [state, formAction] = useActionState(createShift, {});
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedShiftType, setSelectedShiftType] = useState<ShiftType | "">(
    initialShiftType ?? "",
  );
  const [acceptedModalities, setAcceptedModalities] = useState<
    AcceptedModality[]
  >(["hours_bank", "shift_exchange"]);
  const [coverageEnabled, setCoverageEnabled] = useState(false);
  const [coverageStartTime, setCoverageStartTime] = useState("");
  const [coverageEndTime, setCoverageEndTime] = useState("");

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
  const coverageOptions = useMemo(
    () =>
      selectedSchedule
        ? getShiftHalfHourOptions(
            selectedSchedule.startTime,
            selectedSchedule.endTime,
          )
        : [],
    [selectedSchedule],
  );
  const coverageCheck =
    coverageEnabled && selectedSchedule
      ? validateShiftCoverageWindow({
          shiftStartTime: selectedSchedule.startTime,
          shiftEndTime: selectedSchedule.endTime,
          coverageStartTime,
          coverageEndTime,
        })
      : null;
  const coverageEndOptions = selectedSchedule
    ? coverageOptions.filter((option) =>
        validateShiftCoverageWindow({
          shiftStartTime: selectedSchedule.startTime,
          shiftEndTime: selectedSchedule.endTime,
          coverageStartTime,
          coverageEndTime: option,
        }).valid
      )
    : [];
  const canSubmitCoverage =
    !coverageEnabled || Boolean(coverageCheck && coverageCheck.valid);
  const canSubmitModalities = acceptedModalities.length > 0;
  const coverageDurationLabel =
    coverageCheck?.valid ? formatHoursQuantity(coverageCheck.durationHours) : null;

  function applySelectedShiftType(nextShiftType: ShiftType | "") {
    setSelectedShiftType(nextShiftType);

    if (!coverageEnabled) {
      return;
    }

    const nextSchedule = nextShiftType ? getShiftSchedule(nextShiftType) : null;
    setCoverageStartTime(nextSchedule?.startTime ?? "");
    setCoverageEndTime(nextSchedule?.endTime ?? "");
  }

  function handleCoverageToggle(enabled: boolean) {
    setCoverageEnabled(enabled);

    if (enabled) {
      setAcceptedModalities(["hours_bank"]);
      setCoverageStartTime(selectedSchedule?.startTime ?? "");
      setCoverageEndTime(selectedSchedule?.endTime ?? "");
      return;
    }

    setCoverageStartTime("");
    setCoverageEndTime("");
  }

  function handleModalityToggle(
    modality: AcceptedModality,
    checked: boolean,
  ) {
    if (coverageEnabled) {
      return;
    }

    setAcceptedModalities((current) =>
      checked
        ? [...new Set([...current, modality])]
        : current.filter((item) => item !== modality),
    );
  }

  function handleCoverageStartChange(nextStartTime: string) {
    setCoverageStartTime(nextStartTime);

    if (!selectedSchedule) {
      setCoverageEndTime("");
      return;
    }

    const nextEndOptions = coverageOptions.filter((option) =>
      validateShiftCoverageWindow({
        shiftStartTime: selectedSchedule.startTime,
        shiftEndTime: selectedSchedule.endTime,
        coverageStartTime: nextStartTime,
        coverageEndTime: option,
      }).valid
    );

    if (!nextEndOptions.includes(coverageEndTime)) {
      setCoverageEndTime(nextEndOptions[0] ?? "");
    }
  }

  return (
    <form action={formAction}>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Detalles del turno</CardTitle>
          <CardDescription>
            Cuanto mas claro sea este formulario, mas facil sera que otra persona
            compare tu turno y tome una decision rapido.
          </CardDescription>
          <ShiftPublicationScopeFields
            departments={departments}
            jobPositions={jobPositions}
            defaultDepartmentId={defaultDepartmentId}
            defaultJobPositionId={defaultJobPositionId}
            idPrefix="shift-publication"
          />
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
                      applySelectedShiftType(shiftType ?? "");
                    } else {
                      applySelectedShiftType("");
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
                  applySelectedShiftType(
                    isShiftType(nextValue) ? nextValue : "",
                  );
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
            {coverageEnabled ? (
              <input type="hidden" name="accepted_modalities" value="hours_bank" />
            ) : null}
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={coverageEnabled ? undefined : "accepted_modalities"}
                  value="hours_bank"
                  checked={acceptedModalities.includes("hours_bank")}
                  onChange={(event) =>
                    handleModalityToggle("hours_bank", event.target.checked)
                  }
                  disabled={coverageEnabled}
                  className="size-4 rounded border-border"
                />
                Bolsa de horas
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={coverageEnabled ? undefined : "accepted_modalities"}
                  value="shift_exchange"
                  checked={acceptedModalities.includes("shift_exchange")}
                  onChange={(event) =>
                    handleModalityToggle("shift_exchange", event.target.checked)
                  }
                  disabled={coverageEnabled}
                  className="size-4 rounded border-border"
                />
                Intercambio de turno
              </label>
            </div>
            {!canSubmitModalities ? (
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                Selecciona al menos una modalidad para publicar el turno.
              </p>
            ) : null}
          </div>

          <div className="space-y-3 rounded-2xl border border-border/70 bg-secondary/25 px-4 py-4">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={coverageEnabled}
                onChange={(event) => handleCoverageToggle(event.target.checked)}
                disabled={!selectedSchedule}
                className="mt-1 size-4 rounded border-border"
              />
              <span className="space-y-1">
                <span className="block font-semibold text-foreground">
                  Cobertura parcial
                </span>
                <span className="block text-muted-foreground">
                  Pide que te cubran solo una franja del turno. Solo funciona
                  con bolsa de horas.
                </span>
              </span>
            </label>

            {coverageEnabled && selectedSchedule ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="coverage_start_time">
                    Inicio de cobertura
                  </Label>
                  <select
                    id="coverage_start_time"
                    name="coverage_start_time"
                    value={coverageStartTime}
                    onChange={(event) =>
                      handleCoverageStartChange(event.target.value)
                    }
                    className={FORM_CONTROL_CLASSNAME}
                  >
                    {coverageOptions.slice(0, -1).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="coverage_end_time">Fin de cobertura</Label>
                  <select
                    id="coverage_end_time"
                    name="coverage_end_time"
                    value={coverageEndTime}
                    onChange={(event) => setCoverageEndTime(event.target.value)}
                    className={FORM_CONTROL_CLASSNAME}
                  >
                    {coverageEndOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <p className="text-sm text-muted-foreground md:col-span-2">
                  {coverageCheck?.valid
                    ? `La bolsa de horas registrara ${coverageDurationLabel}.`
                    : coverageCheck && !coverageCheck.valid
                      ? coverageCheck.reason
                      : "Selecciona una franja dentro del horario del turno."}
                </p>
              </div>
            ) : null}
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
          <Button
            type="submit"
            disabled={
              isPublishBlockedByCalendar ||
              !canSubmitCoverage ||
              !canSubmitModalities
            }
          >
            Publicar turno
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
