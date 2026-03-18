"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
      <select
        value={role}
        onChange={(event) => setRole(event.target.value as UserRole)}
        disabled={isSubmitting}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
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
        {isSubmitting ? "Guardando..." : "Guardar rol"}
      </Button>
    </div>
  );
}
