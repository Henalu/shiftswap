"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signExchange, type ExchangeMutationResult } from "./actions";
import { FORM_CONTROL_CLASSNAME, cn } from "@/lib/utils";
import type { ExchangeAgreementType, ShiftType } from "@/types";

interface ExchangeRequesterSignatureFormProps {
  exchangeId: string;
  ownerName: string;
  minimumCompensationDate: string;
}

const SHIFT_TYPE_OPTIONS: Array<{ value: ShiftType; label: string }> = [
  { value: "morning", label: "Manana" },
  { value: "afternoon", label: "Tarde" },
  { value: "night", label: "Noche" },
];

export function ExchangeRequesterSignatureForm({
  exchangeId,
  ownerName,
  minimumCompensationDate,
}: ExchangeRequesterSignatureFormProps) {
  const router = useRouter();
  const [agreementType, setAgreementType] = useState<ExchangeAgreementType | "">(
    ""
  );
  const [compensationDate, setCompensationDate] = useState("");
  const [compensationShiftType, setCompensationShiftType] = useState<
    ShiftType | ""
  >("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(): Promise<void> {
    if (!agreementType) {
      toast.error(
        "Elige si el acuerdo es bolsa de horas o intercambio de turno antes de firmar."
      );
      return;
    }

    if (agreementType === "shift_exchange") {
      if (!compensationDate) {
        toast.error("Indica la fecha futura del turno acordado.");
        return;
      }

      if (compensationDate < minimumCompensationDate) {
        toast.error("La fecha del intercambio debe ser desde manana en adelante.");
        return;
      }

      if (!compensationShiftType) {
        toast.error("Selecciona el tipo de turno acordado para la compensacion.");
        return;
      }
    }

    setIsSubmitting(true);

    const formData = new FormData();
    formData.set("exchange_id", exchangeId);
    formData.set("agreement_type", agreementType);

    if (agreementType === "shift_exchange") {
      formData.set("compensation_shift_date", compensationDate);
      formData.set("compensation_shift_type", compensationShiftType);
    }

    const result = (await signExchange(formData)) as ExchangeMutationResult;

    setIsSubmitting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Firma registrada y acuerdo guardado.");
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-secondary/35 p-4">
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            Firma del solicitante
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            Antes de firmar, indica si cubres este turno como bolsa de horas o si
            ya habeis acordado un turno futuro concreto.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className={cn(
              "rounded-2xl border p-4 text-left transition-colors",
              agreementType === "hours_bank"
                ? "border-amber-500/45 bg-amber-500/10"
                : "border-border/70 bg-background/90 hover:border-primary/30"
            )}
            onClick={() => setAgreementType("hours_bank")}
            disabled={isSubmitting}
          >
            <p className="text-sm font-semibold text-foreground">Bolsa de horas</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {ownerName} te quedara debiendo 1 turno. No hace falta definir ahora
              una fecha futura.
            </p>
          </button>

          <button
            type="button"
            className={cn(
              "rounded-2xl border p-4 text-left transition-colors",
              agreementType === "shift_exchange"
                ? "border-sky-500/45 bg-sky-500/10"
                : "border-border/70 bg-background/90 hover:border-primary/30"
            )}
            onClick={() => setAgreementType("shift_exchange")}
            disabled={isSubmitting}
          >
            <p className="text-sm font-semibold text-foreground">
              Intercambio de turno
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Debes dejar registrado el turno de compensacion con una fecha futura
              y si sera de manana, tarde o noche.
            </p>
          </button>
        </div>

        {agreementType === "shift_exchange" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="compensation-shift-date">Fecha futura</Label>
              <Input
                id="compensation-shift-date"
                type="date"
                min={minimumCompensationDate}
                value={compensationDate}
                onChange={(event) => setCompensationDate(event.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="compensation-shift-type">Tipo de turno</Label>
              <select
                id="compensation-shift-type"
                value={compensationShiftType}
                onChange={(event) =>
                  setCompensationShiftType(event.target.value as ShiftType | "")
                }
                disabled={isSubmitting}
                className={FORM_CONTROL_CLASSNAME}
              >
                <option value="">Selecciona un turno</option>
                {SHIFT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            La firma dejara guardado el acuerdo y, cuando ambas partes esten
            firmadas, la solicitud pasara a aprobacion.
          </p>
          <Button onClick={handleSubmit} disabled={isSubmitting || !agreementType}>
            {isSubmitting ? "Firmando..." : "Firmar solicitud"}
          </Button>
        </div>
      </div>
    </div>
  );
}
