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
      <Card>
        <CardHeader>
          <CardTitle>Detalles del turno</CardTitle>
          <CardDescription>
            Rellena los datos del turno que quieres publicar para intercambio
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state?.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
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
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none ring-ring/50 transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              >
                <option value="">Selecciona...</option>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start_time">Hora inicio</Label>
              <Input
                id="start_time"
                name="start_time"
                type="time"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_time">Hora fin</Label>
              <Input
                id="end_time"
                name="end_time"
                type="time"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descripción (opcional)</Label>
            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Notas adicionales sobre el turno..."
              className="flex min-h-[80px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none ring-ring/50 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit">Publicar turno</Button>
        </CardFooter>
      </Card>
    </form>
  );
}
