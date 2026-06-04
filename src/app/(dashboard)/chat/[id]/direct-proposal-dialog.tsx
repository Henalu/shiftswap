"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Send, ShieldCheck } from "lucide-react";
import { sendDirectProposal } from "@/app/(dashboard)/chat/actions";
import { ShiftDatePicker } from "@/app/(dashboard)/shifts/new/shift-date-picker";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CALENDAR_DAY_TYPE_LABELS,
  SHIFT_TYPE_LABELS,
} from "@/lib/constants";
import {
  calendarDayTypeToShiftType,
  getCalendarDayBlockedShiftReason,
  type CalendarDay,
} from "@/lib/calendar";
import { getMinimumCompensationDate } from "@/lib/exchange-compensation";
import { getShiftSchedule, isShiftType } from "@/lib/shifts";
import {
  cn,
  FORM_CONTROL_CLASSNAME,
  formatTimeRange,
} from "@/lib/utils";
import type { ExchangeAgreementType, ShiftType } from "@/types";

interface DirectProposalDialogProps {
  conversationId: string;
  recipientId: string;
  recipientName: string;
  calendarDays?: CalendarDay[] | null;
}

export function DirectProposalDialog({
  conversationId,
  recipientId,
  recipientName,
  calendarDays,
}: DirectProposalDialogProps) {
  const [state, formAction, isPending] = useActionState(
    sendDirectProposal,
    null,
  );
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedShiftType, setSelectedShiftType] = useState<ShiftType | "">("");
  const [agreementType, setAgreementType] =
    useState<ExchangeAgreementType>("hours_bank");

  const calendarMap = useMemo(() => {
    if (!calendarDays) return null;
    const map = new Map<string, CalendarDay>();
    for (const day of calendarDays) {
      map.set(day.date, day);
    }
    return map;
  }, [calendarDays]);

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
  const isCalendarControlledDate = Boolean(calendarHint);
  const canSubmit =
    Boolean(selectedDate && selectedShiftType) &&
    !calendarWarning &&
    !exchangeLockWarning;

  useEffect(() => {
    if (!state?.success) return;

    const timeoutId = window.setTimeout(() => {
      setOpen(false);
      setSelectedDate("");
      setSelectedShiftType("");
      setAgreementType("hours_bank");
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
          setAgreementType("hours_bank");
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
                crea el intercambio y pasara a firma/validacion como el resto.
              </p>
            </div>
          </div>

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
                  setSelectedShiftType(nextShiftType ?? "");
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
                  setSelectedShiftType(isShiftType(nextValue) ? nextValue : "");
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
                    onChange={() => setAgreementType(value)}
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

          {agreementType === "shift_exchange" && (
            <div className="grid gap-4 rounded-2xl border border-border/70 bg-secondary/35 p-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="direct-compensation-date">
                  Fecha del turno que pides
                </Label>
                <input
                  id="direct-compensation-date"
                  name="compensation_shift_date"
                  type="date"
                  min={getMinimumCompensationDate()}
                  required
                  className={FORM_CONTROL_CLASSNAME}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="direct-compensation-type">
                  Turno que pides
                </Label>
                <select
                  id="direct-compensation-type"
                  name="compensation_shift_type"
                  required
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
              </div>
              <p className="md:col-span-2 text-xs text-muted-foreground">
                Al aceptar, validaremos que esa persona realmente tenga ese
                turno disponible en su calendario.
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
