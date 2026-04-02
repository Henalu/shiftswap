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
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <select
        name="rotation_group_id"
        defaultValue={currentGroupId ?? ""}
        aria-label="Grupo de rotacion"
        className={FORM_CONTROL_CLASSNAME + " w-auto min-w-[140px]"}
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
        {isPending ? "Guardando..." : "Asignar"}
      </Button>
      {state.error && (
        <span className="text-xs text-destructive">{state.error}</span>
      )}
    </form>
  );
}
