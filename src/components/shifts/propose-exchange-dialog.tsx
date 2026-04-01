"use client";

import { useActionState, useState } from "react";
import { ArrowLeftRight, Clock } from "lucide-react";
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
import { SHIFT_TYPE_LABELS } from "@/lib/constants";
import { isShiftType } from "@/lib/shifts";
import { FORM_CONTROL_CLASSNAME } from "@/lib/utils";
import type { AcceptedModality, ShiftType } from "@/types";
import { proposeExchange } from "./actions";

interface ProposeExchangeDialogProps {
  shiftId: string;
  acceptedModalities: AcceptedModality[];
}

export function ProposeExchangeDialog({
  shiftId,
  acceptedModalities,
}: ProposeExchangeDialogProps) {
  const [state, formAction, isPending] = useActionState(proposeExchange, null);
  const [open, setOpen] = useState(false);
  const [selectedShiftType, setSelectedShiftType] = useState<ShiftType | "">("");

  const acceptsHoursBank = acceptedModalities.includes("hours_bank");
  const acceptsShiftExchange = acceptedModalities.includes("shift_exchange");

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().slice(0, 10);

  // If the proposal was successful, close the dialog
  if (state?.success && open) {
    setOpen(false);
  }

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
        <Dialog open={open} onOpenChange={setOpen}>
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
              <input type="hidden" name="agreement_type" value="shift_exchange" />

              <div className="space-y-2">
                <Label htmlFor="compensation_shift_date">Fecha del turno que ofreces</Label>
                <Input
                  id="compensation_shift_date"
                  name="compensation_shift_date"
                  type="date"
                  required
                  min={minDate}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="compensation_shift_type">Tipo de turno</Label>
                <select
                  id="compensation_shift_type"
                  name="compensation_shift_type"
                  required
                  value={selectedShiftType}
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
                    )
                  )}
                </select>
              </div>

              {state?.error && (
                <p className="text-sm text-destructive">{state.error}</p>
              )}

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? "Enviando propuesta..." : "Enviar propuesta"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
