"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FORM_CONTROL_CLASSNAME } from "@/lib/utils";
import {
  setAreaScheduleType,
  type ScheduleConfigResult,
} from "@/app/(dashboard)/admin/schedule-config/actions";

interface AreaConfigFormProps {
  departmentId: string;
  currentType: string | null;
}

const initial: ScheduleConfigResult = {};

export function AreaConfigForm({ departmentId, currentType }: AreaConfigFormProps) {
  const [state, formAction, isPending] = useActionState(setAreaScheduleType, initial);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="department_id" value={departmentId} />
      <select
        name="schedule_type"
        defaultValue={currentType ?? ""}
        aria-label="Tipo de jornada"
        className={FORM_CONTROL_CLASSNAME + " w-auto min-w-[160px]"}
        disabled={isPending}
      >
        <option value="">Sin configurar</option>
        <option value="3t5">3T5 (rotativos)</option>
        <option value="jornada_normal">Jornada normal</option>
      </select>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Guardando..." : "Guardar"}
      </Button>
      {state.error && (
        <span className="text-xs text-destructive">{state.error}</span>
      )}
      {state.success && !state.error ? (
        <span className="text-xs text-emerald-700">Guardado</span>
      ) : null}
    </form>
  );
}
