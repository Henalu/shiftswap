"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FORM_CONTROL_CLASSNAME, cn } from "@/lib/utils";
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
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
      <select
        value={role}
        onChange={(event) => setRole(event.target.value as UserRole)}
        disabled={isSubmitting}
        aria-label={`Rol asignado a ${fullName}`}
        className={cn(FORM_CONTROL_CLASSNAME, "h-10 sm:w-56")}
      >
        {ROLE_OPTIONS.map((roleOption) => (
          <option key={roleOption} value={roleOption}>
            {USER_ROLE_LABELS[roleOption]}
          </option>
        ))}
      </select>

      <Button
        type="button"
        size="sm"
        onClick={handleSubmit}
        disabled={isSubmitting || role === currentRole}
        className="w-full sm:w-auto"
      >
        {isSubmitting ? "Guardando..." : "Guardar"}
      </Button>
    </div>
  );
}
