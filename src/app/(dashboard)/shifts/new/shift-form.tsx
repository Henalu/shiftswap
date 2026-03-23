"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SHIFT_TYPE_LABELS } from "@/lib/constants";
import { FORM_CONTROL_CLASSNAME } from "@/lib/utils";
import { createShift } from "./actions";
import type { ShiftType } from "@/types";

interface ShiftFormProps {
  departmentId: string;
  userId: string;
}

export function ShiftForm({ departmentId, userId }: ShiftFormProps) {
  const [state, formAction] = useActionState(createShift, {});

  return (
    <form action={formAction}>
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="department_id" value={departmentId} />

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Detalles del turno</CardTitle>
          <CardDescription>
            Cuanto mas claro sea este formulario, mas facil sera que otra persona
            compare tu turno y tome una decision rapido.
          </CardDescription>
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
              <Input
                id="date"
                name="date"
                type="date"
                required
                min={new Date().toISOString().split("T")[0]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shift_type">Tipo de turno</Label>
              <select
                id="shift_type"
                name="shift_type"
                required
                className={FORM_CONTROL_CLASSNAME}
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
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start_time">Hora de inicio</Label>
              <Input id="start_time" name="start_time" type="time" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_time">Hora de fin</Label>
              <Input id="end_time" name="end_time" type="time" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Notas opcionales</Label>
            <textarea
              id="description"
              name="description"
              rows={4}
              placeholder="Anade solo el contexto que ayude a valorar el intercambio."
              className={FORM_CONTROL_CLASSNAME + " min-h-28 py-3"}
            />
            <p className="text-sm text-muted-foreground">
              Ejemplo: si necesitas cerrar con otro turno de manana, si hay una
              restriccion concreta o si el horario requiere aclaracion.
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex flex-wrap justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            El turno se publicara listo para recibir interes.
          </p>
          <Button type="submit">Publicar turno</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
