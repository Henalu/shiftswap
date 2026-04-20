"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Clock } from "lucide-react";
import { CalendarDateContext } from "@/components/shifts/calendar-date-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CALENDAR_DAY_TYPE_STYLES, SHIFT_TYPE_LABELS } from "@/lib/constants";
import {
  calendarDayTypeToCompensationShiftType,
  getCalendarDayBlockedShiftReason,
  type CalendarDay,
} from "@/lib/calendar";
import { getMinimumCompensationDate } from "@/lib/exchange-compensation";
import { isShiftType } from "@/lib/shifts";
import { cn, FORM_CONTROL_CLASSNAME } from "@/lib/utils";
import type { AcceptedModality, ShiftType } from "@/types";
import { proposeExchange } from "./actions";

interface ProposeExchangeDialogProps {
  shiftId: string;
  acceptedModalities: AcceptedModality[];
  calendarDays?: CalendarDay[] | null;
}

export function ProposeExchangeDialog({
  shiftId,
  acceptedModalities,
  calendarDays,
}: ProposeExchangeDialogProps) {
  const [state, formAction, isPending] = useActionState(proposeExchange, null);
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedShiftType, setSelectedShiftType] = useState<ShiftType | "">(
    "",
  );

  const acceptsHoursBank = acceptedModalities.includes("hours_bank");
  const acceptsShiftExchange = acceptedModalities.includes("shift_exchange");
  const minDate = getMinimumCompensationDate();

  const calendarMap = useMemo(() => {
    if (!calendarDays) return null;
    const map = new Map<string, CalendarDay>();
    for (const day of calendarDays) {
      map.set(day.date, day);
    }
    return map;
  }, [calendarDays]);

  const calendarHint = calendarMap?.get(selectedDate) ?? null;
  const autoCompensationShiftType = calendarHint
    ? calendarDayTypeToCompensationShiftType(calendarHint.dayType)
    : null;
  const isAutomaticCalendarMode = Boolean(calendarMap);
  const calendarWarning = calendarHint?.isVacation
    ? "Tienes vacaciones registradas para este dia."
    : calendarHint?.dayType === "rest"
      ? "No puedes ofrecer un dia de descanso como cambio."
      : calendarHint && !autoCompensationShiftType
        ? "Ese dia no puede ofrecerse como compensacion."
        : null;
  const fallbackDateWarning =
    isAutomaticCalendarMode && selectedDate && !calendarHint
      ? "No hemos podido anticipar esa fecha con el calendario cargado."
      : null;
  const exchangeLockReason =
    calendarHint && selectedShiftType
      ? getCalendarDayBlockedShiftReason(calendarHint, selectedShiftType)
      : null;
  const exchangeLockWarning =
    exchangeLockReason === "received"
      ? "Ese turno ya lo has recibido en otro intercambio activo y no puedes volver a ofrecerlo."
      : exchangeLockReason === "delivered"
        ? "Ese turno ya lo has cedido en otro intercambio activo y no puedes volver a ofrecerlo."
        : null;
  const canSubmitShiftExchange = isAutomaticCalendarMode
    ? Boolean(
        selectedDate &&
          autoCompensationShiftType &&
          !calendarWarning &&
          !exchangeLockWarning,
      )
    : Boolean(selectedDate && selectedShiftType);
  const readOnlyShiftLabel = autoCompensationShiftType
    ? SHIFT_TYPE_LABELS[autoCompensationShiftType]
    : calendarHint?.isVacation
      ? "Vacaciones no intercambiables"
      : calendarHint?.dayType === "rest"
        ? "Descanso no intercambiable"
        : "";

  useEffect(() => {
    if (!state?.success) return;

    const timeoutId = window.setTimeout(() => {
      setOpen(false);
      setSelectedDate("");
      setSelectedShiftType("");
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [state?.success]);

  return (
    <div className="flex flex-wrap gap-3">
      {acceptsHoursBank && (
        <form action={formAction}>
          <input type="hidden" name="shift_id" value={shiftId} />
          <input type="hidden" name="agreement_type" value="hours_bank" />
          <Button type="submit" disabled={isPending}>
            <Clock className="size-4" />
            {isPending ? "Enviando..." : "Aceptar"}
          </Button>
        </form>
      )}

      {acceptsShiftExchange && (
        <Dialog
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (!nextOpen) {
              setSelectedDate("");
              setSelectedShiftType("");
            }
          }}
        >
          <DialogTrigger asChild>
            <Button variant="secondary">
              <ArrowLeftRight className="size-4" />
              Cambiar por
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Proponer intercambio</DialogTitle>
              <DialogDescription>
                Indica que turno ofreces a cambio. El publicador decidira si le
                conviene.
              </DialogDescription>
            </DialogHeader>

            <form action={formAction} className="space-y-5">
              <input type="hidden" name="shift_id" value={shiftId} />
              <input
                type="hidden"
                name="agreement_type"
                value="shift_exchange"
              />

              <div className="space-y-2">
                <Label htmlFor="compensation_shift_date">
                  Fecha del turno que ofreces
                </Label>
                <Input
                  id="compensation_shift_date"
                  name="compensation_shift_date"
                  type="date"
                  required
                  min={minDate}
                  value={selectedDate}
                  onChange={(event) => {
                    const nextDate = event.target.value;
                    setSelectedDate(nextDate);

                    if (!calendarMap) {
                      return;
                    }

                    const nextDay = calendarMap.get(nextDate);
                    const nextValue = nextDay
                      ? calendarDayTypeToCompensationShiftType(nextDay.dayType)
                      : null;
                    setSelectedShiftType(nextValue ?? "");
                  }}
                />
                {calendarHint && calendarWarning && (
                  <CalendarDateContext
                    day={calendarHint}
                    title="Fecha no disponible"
                    description={calendarWarning}
                  />
                )}
                {calendarHint &&
                  !calendarWarning &&
                  exchangeLockWarning && (
                    <CalendarDateContext
                      day={calendarHint}
                      title="Turno ya comprometido"
                      description={exchangeLockWarning}
                    />
                  )}
                {calendarHint &&
                  autoCompensationShiftType &&
                  !calendarWarning &&
                  !exchangeLockWarning && (
                    <CalendarDateContext
                      day={calendarHint}
                      title="Compensacion detectada"
                      description={`Tu calendario marca ${readOnlyShiftLabel.toLowerCase()} para este dia. La propuesta ofrecera automaticamente ese turno.`}
                    />
                  )}
                {fallbackDateWarning && (
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                    {fallbackDateWarning}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="compensation_shift_type">
                  Turno que ofreces
                </Label>
                {isAutomaticCalendarMode ? (
                  <>
                    {autoCompensationShiftType ? (
                      <input
                        type="hidden"
                        name="compensation_shift_type"
                        value={autoCompensationShiftType}
                      />
                    ) : null}
                    <div
                      id="compensation_shift_type"
                      className={cn(
                        FORM_CONTROL_CLASSNAME,
                        "items-center font-medium",
                        calendarHint && autoCompensationShiftType
                          ? CALENDAR_DAY_TYPE_STYLES[calendarHint.dayType]
                          : "text-muted-foreground",
                      )}
                    >
                      {readOnlyShiftLabel ||
                        "Selecciona primero una fecha valida"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      El tipo se rellena automaticamente con lo que realmente
                      tienes ese dia en tu calendario.
                    </p>
                  </>
                ) : (
                  <>
                    <select
                      id="compensation_shift_type"
                      name="compensation_shift_type"
                      required
                      value={selectedShiftType}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setSelectedShiftType(
                          isShiftType(nextValue) ? nextValue : "",
                        );
                      }}
                      className={FORM_CONTROL_CLASSNAME}
                    >
                      <option value="">Selecciona</option>
                      {(
                        Object.entries(SHIFT_TYPE_LABELS) as [
                          ShiftType,
                          string,
                        ][]
                      ).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      No hemos podido cargar tu calendario. Elige manualmente el
                      turno que ofreces.
                    </p>
                  </>
                )}
              </div>

              {state?.error && (
                <p className="text-sm text-destructive">{state.error}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isPending || !canSubmitShiftExchange}
              >
                {isPending ? "Enviando propuesta..." : "Enviar propuesta"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
