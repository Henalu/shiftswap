"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAccountGateState } from "@/lib/user-profiles";
import { isSuperAdmin, isUserRole } from "@/lib/user-roles";
import type { UserRole, ValidationStatus } from "@/types";

export interface ChangeUserRoleResult {
  success?: true;
  error?: string;
}

interface RoleTarget {
  id: string;
  role: UserRole;
  company_id: string | null;
  department_id: string | null;
  validation_status: ValidationStatus;
}

async function getAuthenticatedSuperAdminId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const accountState = await getAccountGateState(user.id);
  if (!accountState || !isSuperAdmin(accountState.role)) {
    return null;
  }

  return user.id;
}

async function getRoleTarget(userId: string): Promise<RoleTarget | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, role, company_id, department_id, validation_status")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[admin/users] Failed to load role target", {
      userId,
      message: error.message,
    });
    return null;
  }

  return (data as RoleTarget | null) ?? null;
}

async function getSuperAdminCount(): Promise<number> {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("user_profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "super_admin");

  return count ?? 0;
}

export async function changeUserRole(
  formData: FormData
): Promise<ChangeUserRoleResult> {
  const targetUserId = (formData.get("user_id") as string | null)?.trim();
  const nextRoleValue = (formData.get("role") as string | null)?.trim();

  if (!targetUserId || !nextRoleValue || !isUserRole(nextRoleValue)) {
    return { error: "La solicitud de cambio de rol es inválida." };
  }

  const adminUserId = await getAuthenticatedSuperAdminId();
  if (!adminUserId) {
    return { error: "Solo un super admin puede cambiar roles." };
  }

  const target = await getRoleTarget(targetUserId);
  if (!target) {
    return { error: "No se encontró el usuario indicado." };
  }

  if (target.validation_status !== "approved") {
    return {
      error: "Solo se pueden cambiar roles de usuarios ya aprobados.",
    };
  }

  if (target.role === nextRoleValue) {
    return { success: true };
  }

  if (target.role === "super_admin" && nextRoleValue !== "super_admin") {
    const superAdminCount = await getSuperAdminCount();
    if (superAdminCount <= 1) {
      return {
        error: "No puedes degradar al último super admin de la plataforma.",
      };
    }
  }

  if (nextRoleValue !== "super_admin" && !target.company_id) {
    return {
      error:
        "Ese usuario no tiene empresa asignada. Debe recuperar un scope antes de salir de super admin.",
    };
  }

  if (nextRoleValue === "department_admin" && !target.department_id) {
    return {
      error:
        "Ese usuario no tiene departamento asignado. No puede ser admin de departamento.",
    };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("user_profiles")
    .update({
      role: nextRoleValue,
      is_admin: nextRoleValue !== "member",
    })
    .eq("id", targetUserId);

  if (error) {
    return { error: "No se pudo actualizar el rol. " + error.message };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/validations");
  revalidatePath("/", "layout");
  return { success: true };
}
