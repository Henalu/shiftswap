"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Send, ShieldCheck } from "lucide-react";
import { sendDirectProposal } from "@/app/(dashboard)/chat/actions";
import { ShiftDatePicker } from "@/app/(dashboard)/shifts/new/shift-date-picker";
import { CalendarDateContext } from "@/components/shifts/calendar-date-context";
import { ShiftPublicationScopeFields } from "@/components/shifts/shift-publication-scope-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CALENDAR_DAY_TYPE_LABELS,
  SHIFT_TYPE_LABELS,
} from "@/lib/constants";
import {
  calendarDayTypeToCompensationShiftType,
  calendarDayTypeToShiftType,
  getCalendarDayBlockedShiftReason,
  type CalendarDay,
} from "@/lib/calendar";
import { getMinimumCompensationDate } from "@/lib/exchange-compensation";
import {
  formatHoursQuantity,
  getShiftHalfHourOptions,
  getShiftSchedule,
  isShiftType,
  validateShiftCoverageWindow,
} from "@/lib/shifts";
import {
  cn,
  FORM_CONTROL_CLASSNAME,
  formatTimeRange,
} from "@/lib/utils";
import type {
  Department,
  ExchangeAgreementType,
  JobPosition,
  ShiftType,
} from "@/types";

interface DirectProposalDialogProps {
  conversationId: string;
  recipientId: string;
  recipientName: string;
  publicationScope: {
    departments: Department[];
    jobPositions: JobPosition[];
    defaultDepartmentId: string;
    defaultJobPositionId: string | null;
  };
  calendarDays?: CalendarDay[] | null;
  recipientCalendarDays?: CalendarDay[] | null;
}

export function DirectProposalDialog({
  conversationId,
  recipientId,
  recipientName,
  publicationScope,
  calendarDays,
  recipientCalendarDays,
}: DirectProposalDialogProps) {
  const [state, formAction, isPending] = useActionState(
    sendDirectProposal,
    null,
  );
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedShiftType, setSelectedShiftType] = useState<ShiftType | "">("");
  const [compensationDate, setCompensationDate] = useState("");
  const [compensationShiftType, setCompensationShiftType] =
    useState<ShiftType | "">("");
  const [agreementType, setAgreementType] =
    useState<ExchangeAgreementType>("hours_bank");
  const [coverageEnabled, setCoverageEnabled] = useState(false);
  const [coverageStartTime, setCoverageStartTime] = useState("");
  const [coverageEndTime, setCoverageEndTime] = useState("");
  const minimumCompensationDate = useMemo(() => getMinimumCompensationDate(), []);

  const calendarMap = useMemo(() => {
    if (!calendarDays) return null;
    const map = new Map<string, CalendarDay>();
    for (const day of calendarDays) {
      map.set(day.date, day);
    }
    return map;
  }, [calendarDays]);

  const recipientCalendarMap = useMemo(() => {
    if (!recipientCalendarDays) return null;
    const map = new Map<string, CalendarDay>();
    for (const day of recipientCalendarDays) {
      map.set(day.date, day);
    }
    return map;
  }, [recipientCalendarDays]);

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
      ? "Ese turno ya lo has recibido mediante un intercambio activo."
      : exchangeLockReason === "delivered"
        ? "Ese turno ya lo has cedido en un intercambio activo."
        : null;
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
    agreementType !== "hours_bank" ||
    !coverageEnabled ||
    Boolean(coverageCheck && coverageCheck.valid);
  const coverageDurationLabel =
    coverageCheck?.valid ? formatHoursQuantity(coverageCheck.durationHours) : null;
  const isCalendarControlledDate = Boolean(calendarHint);
  const compensationCalendarHint =
    recipientCalendarMap?.get(compensationDate) ?? null;
  const compensationCalendarWarning = compensationCalendarHint
    ? compensationCalendarHint.dayType === "rest"
      ? `${recipientName} descansa ese dia segun su calendario.`
      : compensationCalendarHint.isVacation
        ? `${recipientName} tiene vacaciones registradas para ese dia.`
        : null
    : null;
  const compensationOutOfRangeWarning =
    recipientCalendarMap && compensationDate && !compensationCalendarHint
      ? `No hemos podido anticipar esa fecha con el calendario de ${recipientName}.`
      : null;
  const compensationExchangeLockReason =
    compensationCalendarHint && compensationShiftType
      ? getCalendarDayBlockedShiftReason(
          compensationCalendarHint,
          compensationShiftType,
        )
      : null;
  const compensationExchangeLockWarning =
    compensationExchangeLockReason === "received"
      ? `${recipientName} ya recibe ese turno mediante un intercambio activo.`
      : compensationExchangeLockReason === "delivered"
        ? `${recipientName} ya ha cedido ese turno en un intercambio activo.`
        : null;
  const selectedCompensationSchedule = compensationShiftType
    ? getShiftSchedule(compensationShiftType)
    : null;
  const isCompensationCalendarControlledDate = Boolean(
    compensationCalendarHint,
  );
  const canSubmitCompensation =
    agreementType === "hours_bank" ||
    (Boolean(compensationDate && compensationShiftType) &&
      !compensationCalendarWarning &&
      !compensationExchangeLockWarning);
  const canSubmit =
    Boolean(selectedDate && selectedShiftType) &&
    !calendarWarning &&
    !exchangeLockWarning &&
    canSubmitCoverage &&
    canSubmitCompensation;

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
      setAgreementType("hours_bank");
      setCompensationDate("");
      setCompensationShiftType("");
      setCoverageStartTime(selectedSchedule?.startTime ?? "");
      setCoverageEndTime(selectedSchedule?.endTime ?? "");
      return;
    }

    setCoverageStartTime("");
    setCoverageEndTime("");
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

  useEffect(() => {
    if (!state?.success) return;

    const timeoutId = window.setTimeout(() => {
      setOpen(false);
      setSelectedDate("");
      setSelectedShiftType("");
      setCompensationDate("");
      setCompensationShiftType("");
      setAgreementType("hours_bank");
      setCoverageEnabled(false);
      setCoverageStartTime("");
      setCoverageEndTime("");
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [state?.success]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setSelectedDate("");
          setSelectedShiftType("");
          setCompensationDate("");
          setCompensationShiftType("");
          setAgreementType("hours_bank");
          setCoverageEnabled(false);
          setCoverageStartTime("");
          setCoverageEndTime("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Send className="size-4" />
          Propuesta directa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar propuesta a {recipientName}</DialogTitle>
          <DialogDescription>
            No se publica en el tablon. Solo la vera esta persona.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-5">
          <input type="hidden" name="conversation_id" value={conversationId} />
          <input type="hidden" name="recipient_user_id" value={recipientId} />

          {state?.error && (
            <p className="rounded-2xl border border-destructive/15 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {state.error}
            </p>
          )}

          <div className="rounded-2xl border border-border/70 bg-secondary/45 px-4 py-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-4 text-primary" />
              <p>
                La propuesta queda dirigida a {recipientName}. Si acepta, se
                crea el intercambio y quedara pendiente de tu firma final.
              </p>
            </div>
          </div>

          <ShiftPublicationScopeFields
            departments={publicationScope.departments}
            jobPositions={publicationScope.jobPositions}
            defaultDepartmentId={publicationScope.defaultDepartmentId}
            defaultJobPositionId={publicationScope.defaultJobPositionId}
            idPrefix="direct-publication"
            summaryPrefix="Esta propuesta quedara asociada"
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="direct-date">Fecha de tu turno</Label>
              <ShiftDatePicker
                id="direct-date"
                name="date"
                value={selectedDate}
                calendarDays={calendarDays}
                onChange={(date) => {
                  setSelectedDate(date);
                  if (!calendarMap) {
                    return;
                  }

                  const day = calendarMap.get(date);
                  const nextShiftType = day
                    ? calendarDayTypeToShiftType(day.dayType)
                    : null;
                  applySelectedShiftType(nextShiftType ?? "");
                }}
              />
              {calendarHint && calendarWarning && (
                <CalendarDateContext
                  day={calendarHint}
                  title="Fecha no disponible"
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
                  title="Turno detectado"
                  description={`Tu calendario marca ${CALENDAR_DAY_TYPE_LABELS[
                    calendarHint.dayType
                  ].toLowerCase()} para ese dia.`}
                />
              )}
              {calendarOutOfRangeWarning && (
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  {calendarOutOfRangeWarning}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="direct-shift-type">Tipo de turno</Label>
              {calendarHint && !calendarWarning && selectedShiftType && (
                <input type="hidden" name="shift_type" value={selectedShiftType} />
              )}
              <select
                id="direct-shift-type"
                name={calendarHint && !calendarWarning ? undefined : "shift_type"}
                required={!isCalendarControlledDate}
                value={selectedShiftType}
                disabled={isCalendarControlledDate}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  applySelectedShiftType(
                    isShiftType(nextValue) ? nextValue : "",
                  );
                }}
                className={FORM_CONTROL_CLASSNAME}
              >
                <option value="">Selecciona</option>
                {(Object.entries(SHIFT_TYPE_LABELS) as [ShiftType, string][]).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
              <p className="text-xs text-muted-foreground">
                {selectedSchedule
                  ? `Horario: ${formatTimeRange(
                      selectedSchedule.startTime,
                      selectedSchedule.endTime,
                    )}.`
                  : "El horario se calcula automaticamente."}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Modalidad</Label>
            <div className="grid gap-3 md:grid-cols-2">
              {(
                [
                  ["hours_bank", "Bolsa de horas", "Te cubre y queda saldo pendiente."],
                  [
                    "shift_exchange",
                    "Intercambio de turno",
                    "Pides un turno suyo a cambio.",
                  ],
                ] as [ExchangeAgreementType, string, string][]
              ).map(([value, title, description]) => (
                <label
                  key={value}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors",
                    agreementType === value
                      ? "border-primary/40 bg-primary/10"
                      : "border-border/70 bg-background hover:border-primary/25",
                  )}
                >
                  <input
                    type="radio"
                    name="agreement_type"
                    value={value}
                    checked={agreementType === value}
                    onChange={() => {
                      setAgreementType(value);
                      if (value === "hours_bank") {
                        setCompensationDate("");
                        setCompensationShiftType("");
                      } else {
                        handleCoverageToggle(false);
                      }
                    }}
                    className="mt-1 size-4"
                  />
                  <span>
                    <span className="block font-semibold text-foreground">
                      {title}
                    </span>
                    <span className="mt-1 block text-muted-foreground">
                      {description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {agreementType === "hours_bank" && (
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
                    Pide que {recipientName} cubra solo una franja de tu turno.
                  </span>
                </span>
              </label>

              {coverageEnabled && selectedSchedule ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="direct-coverage-start">
                      Inicio de cobertura
                    </Label>
                    <select
                      id="direct-coverage-start"
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
                    <Label htmlFor="direct-coverage-end">
                      Fin de cobertura
                    </Label>
                    <select
                      id="direct-coverage-end"
                      name="coverage_end_time"
                      value={coverageEndTime}
                      onChange={(event) =>
                        setCoverageEndTime(event.target.value)
                      }
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
          )}

          {agreementType === "shift_exchange" && (
            <div className="grid gap-4 rounded-2xl border border-border/70 bg-secondary/35 p-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="direct-compensation-date">
                  Fecha del turno que pides
                </Label>
                <ShiftDatePicker
                  id="direct-compensation-date"
                  name="compensation_shift_date"
                  value={compensationDate}
                  minDate={minimumCompensationDate}
                  calendarDays={recipientCalendarDays}
                  dialogLabel={`Seleccionar fecha del turno de ${recipientName}`}
                  onChange={(date) => {
                    setCompensationDate(date);
                    if (!recipientCalendarMap) {
                      return;
                    }

                    const day = recipientCalendarMap.get(date);
                    const nextShiftType = day
                      ? calendarDayTypeToCompensationShiftType(day.dayType)
                      : null;
                    setCompensationShiftType(nextShiftType ?? "");
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="direct-compensation-type">
                  Turno que pides
                </Label>
                {compensationCalendarHint &&
                  !compensationCalendarWarning &&
                  compensationShiftType && (
                    <input
                      type="hidden"
                      name="compensation_shift_type"
                      value={compensationShiftType}
                    />
                  )}
                <select
                  id="direct-compensation-type"
                  name={
                    compensationCalendarHint && !compensationCalendarWarning
                      ? undefined
                      : "compensation_shift_type"
                  }
                  required={!isCompensationCalendarControlledDate}
                  value={compensationShiftType}
                  disabled={isCompensationCalendarControlledDate}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setCompensationShiftType(
                      isShiftType(nextValue) ? nextValue : "",
                    );
                  }}
                  className={FORM_CONTROL_CLASSNAME}
                >
                  <option value="">Selecciona</option>
                  {(Object.entries(SHIFT_TYPE_LABELS) as [ShiftType, string][]).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
                <p className="text-xs text-muted-foreground">
                  {selectedCompensationSchedule
                    ? `Horario: ${formatTimeRange(
                        selectedCompensationSchedule.startTime,
                        selectedCompensationSchedule.endTime,
                      )}.`
                    : "El horario se calcula automaticamente."}
                </p>
              </div>
              {compensationCalendarHint && compensationCalendarWarning && (
                <CalendarDateContext
                  day={compensationCalendarHint}
                  title="Fecha no disponible"
                  description={compensationCalendarWarning}
                  className="md:col-span-2"
                />
              )}
              {compensationCalendarHint &&
                !compensationCalendarWarning &&
                compensationExchangeLockWarning && (
                  <CalendarDateContext
                    day={compensationCalendarHint}
                    title="Turno ya comprometido"
                    description={compensationExchangeLockWarning}
                    className="md:col-span-2"
                  />
                )}
              {compensationCalendarHint &&
                !compensationCalendarWarning &&
                !compensationExchangeLockWarning && (
                  <CalendarDateContext
                    day={compensationCalendarHint}
                    title="Turno detectado"
                    description={`El calendario de ${recipientName} marca ${CALENDAR_DAY_TYPE_LABELS[
                      compensationCalendarHint.dayType
                    ].toLowerCase()} para ese dia.`}
                    className="md:col-span-2"
                  />
                )}
              {compensationOutOfRangeWarning && (
                <p className="md:col-span-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                  {compensationOutOfRangeWarning}
                </p>
              )}
              <p className="md:col-span-2 text-xs text-muted-foreground">
                Al aceptar, validaremos que esa persona realmente tenga ese
                turno disponible en su calendario antes de cerrar el acuerdo.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="direct-description">Notas</Label>
            <Textarea
              id="direct-description"
              name="description"
              placeholder="Contexto breve para que la otra persona pueda decidir."
            />
          </div>

          <Button type="submit" className="w-full" disabled={isPending || !canSubmit}>
            {isPending ? "Enviando..." : "Enviar propuesta directa"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
