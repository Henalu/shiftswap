"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createVacation,
  type VacationMutationResult,
} from "@/app/(dashboard)/calendar/vacations/actions";

const initial: VacationMutationResult = {};

export function VacationForm() {
  const [state, formAction, isPending] = useActionState(createVacation, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="start_date">Fecha de inicio</Label>
          <Input
            id="start_date"
            name="start_date"
            type="date"
            required
            disabled={isPending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">Fecha de fin</Label>
          <Input
            id="end_date"
            name="end_date"
            type="date"
            required
            disabled={isPending}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea
          id="notes"
          name="notes"
          placeholder="Motivo o comentarios adicionales..."
          rows={2}
          disabled={isPending}
        />
      </div>

      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      {state.success && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">Vacaciones registradas correctamente.</p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Guardando..." : "Registrar vacaciones"}
      </Button>
    </form>
  );
}
