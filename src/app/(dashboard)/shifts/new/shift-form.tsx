"use client";

import { useActionState, useState } from "react";
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
import { SHIFT_TYPE_LABELS } from "@/lib/constants";
import { getShiftSchedule, isShiftType } from "@/lib/shifts";
import { formatTimeRange, FORM_CONTROL_CLASSNAME } from "@/lib/utils";
import type { ShiftType } from "@/types";
import { createShift } from "./actions";

interface ShiftFormProps {
  areaName: string;
  departmentName: string;
}

export function ShiftForm({ areaName, departmentName }: ShiftFormProps) {
  const [state, formAction] = useActionState(createShift, {});
  const [selectedShiftType, setSelectedShiftType] = useState<ShiftType | "">("");
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
                value={selectedShiftType}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setSelectedShiftType(isShiftType(nextValue) ? nextValue : "");
                }}
                className={FORM_CONTROL_CLASSNAME}
                aria-describedby="shift-schedule-help shift-schedule-current"
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

          <div
            id="shift-schedule-help"
            className="rounded-2xl border border-border/70 bg-secondary/40 px-4 py-3 text-sm"
          >
            <p className="font-medium text-foreground">
              El horario se asigna automaticamente segun el tipo de turno.
            </p>
            <p className="mt-1 text-muted-foreground">
              Manana 06:00 - 14:00, Tarde 14:00 - 22:00 y Noche 22:00 - 06:00.
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
              Anade solo el contexto que ayude a valorar el intercambio, como una
              restriccion puntual o una preferencia de compensacion.
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
