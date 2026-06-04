"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FORM_CONTROL_CLASSNAME } from "@/lib/utils";
import {
  assignUserRotationGroup,
  type ScheduleConfigResult,
} from "@/app/(dashboard)/admin/schedule-config/actions";

interface UserRotationFormProps {
  userId: string;
  currentGroupId: string | null;
  rotationGroups: { id: string; code: string; label: string }[];
}

const initial: ScheduleConfigResult = {};

export function UserRotationForm({
  userId,
  currentGroupId,
  rotationGroups,
}: UserRotationFormProps) {
  const [state, formAction, isPending] = useActionState(assignUserRotationGroup, initial);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <select
        name="rotation_group_id"
        defaultValue={currentGroupId ?? ""}
        aria-label="Grupo de rotacion"
        className={FORM_CONTROL_CLASSNAME + " min-w-[160px]"}
        disabled={isPending}
      >
        <option value="">Sin grupo</option>
        {rotationGroups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.label}
          </option>
        ))}
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
