"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FORM_CONTROL_CLASSNAME } from "@/lib/utils";
import { USER_ROLE_LABELS } from "@/lib/user-roles";
import type { UserRole } from "@/types";
import { changeUserRole } from "./actions";

interface UserRoleFormProps {
  userId: string;
  fullName: string;
  currentRole: UserRole;
}

const ROLE_OPTIONS: UserRole[] = [
  "member",
  "department_admin",
  "hr_admin",
  "super_admin",
];

export function UserRoleForm({
  userId,
  fullName,
  currentRole,
}: UserRoleFormProps) {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>(currentRole);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setIsSubmitting(true);

    const formData = new FormData();
    formData.set("user_id", userId);
    formData.set("role", role);

    const result = await changeUserRole(formData);
    setIsSubmitting(false);

    if (result.error) {
      toast.error(result.error);
      setRole(currentRole);
      return;
    }

    toast.success(`Rol actualizado para ${fullName}.`);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Rol asignado
        </p>
        <p className="text-sm text-muted-foreground">
          Ajusta el alcance administrativo sin salir de esta vista.
        </p>
      </div>
      <select
        value={role}
        onChange={(event) => setRole(event.target.value as UserRole)}
        disabled={isSubmitting}
        className={FORM_CONTROL_CLASSNAME}
      >
        {ROLE_OPTIONS.map((roleOption) => (
          <option key={roleOption} value={roleOption}>
            {USER_ROLE_LABELS[roleOption]}
          </option>
        ))}
      </select>

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting || role === currentRole}
        className="w-full"
      >
        {isSubmitting ? "Guardando..." : "Guardar cambios"}
      </Button>
    </div>
  );
}
