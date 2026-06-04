"use server";

import { revalidatePath } from "next/cache";
import { getDepartmentArea } from "@/lib/departments";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  canAccessScopedProfile,
  hasAdminPanelAccess,
  isSuperAdmin,
} from "@/lib/user-roles";
import type { Department, UserRole } from "@/types";

export interface ScheduleConfigResult {
  success?: true;
  error?: string;
}

interface ScheduleAdmin {
  userId: string;
  role: UserRole;
  company_id: string | null;
  department_id: string | null;
}

async function requireAdmin(): Promise<ScheduleAdmin | ScheduleConfigResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "No autorizado." };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role, company_id, department_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !hasAdminPanelAccess(profile.role as UserRole)) {
    return { error: "No tienes permisos para esta accion." };
  }

  return {
    userId: user.id,
    role: profile.role as UserRole,
    company_id: profile.company_id,
    department_id: profile.department_id,
  };
}

function canManageCompany(auth: ScheduleAdmin, companyId: string | null) {
  if (isSuperAdmin(auth.role)) {
    return true;
  }

  return Boolean(auth.company_id && companyId && auth.company_id === companyId);
}

async function canManageAreaConfig(
  admin: ReturnType<typeof createAdminClient>,
  auth: ScheduleAdmin,
  departmentId: string
) {
  const { data: targetDepartment } = await admin
    .from("departments")
    .select("id, company_id, parent_department_id")
    .eq("id", departmentId)
    .maybeSingle();

  if (!targetDepartment || !canManageCompany(auth, targetDepartment.company_id)) {
    return false;
  }

  if (auth.role !== "department_admin") {
    return true;
  }

  if (!auth.department_id) {
    return false;
  }

  const { data: departments } = await admin
    .from("departments")
    .select("id, company_id, name, parent_department_id, is_assignable, created_at")
    .eq("company_id", targetDepartment.company_id);

  const actorArea = getDepartmentArea(
    (departments ?? []) as Department[],
    auth.department_id
  );

  return actorArea?.id === targetDepartment.id;
}

export async function setAreaScheduleType(
  _prevState: ScheduleConfigResult,
  formData: FormData
): Promise<ScheduleConfigResult> {
  const departmentId = formData.get("department_id") as string;
  const scheduleType = formData.get("schedule_type") as string;

  if (!departmentId || !scheduleType) {
    return { error: "Faltan datos obligatorios." };
  }

  if (scheduleType !== "3t5" && scheduleType !== "jornada_normal") {
    return { error: "Tipo de jornada no valido." };
  }

  const auth = await requireAdmin();
  if (!("role" in auth)) return auth;

  const admin = createAdminClient();

  if (!(await canManageAreaConfig(admin, auth, departmentId))) {
    return { error: "No tienes permisos para editar esta area." };
  }

  const { error } = await admin
    .from("area_schedule_configs")
    .upsert(
      { department_id: departmentId, schedule_type: scheduleType },
      { onConflict: "department_id" }
    );

  if (error) return { error: error.message };

  revalidatePath("/admin/schedule-config");
  return { success: true };
}

export async function assignUserRotationGroup(
  _prevState: ScheduleConfigResult,
  formData: FormData
): Promise<ScheduleConfigResult> {
  const userId = formData.get("user_id") as string;
  const rotationGroupId = (formData.get("rotation_group_id") as string | null)
    ?.trim();

  if (!userId) {
    return { error: "Faltan datos obligatorios." };
  }

  const auth = await requireAdmin();
  if (!("role" in auth)) return auth;

  const admin = createAdminClient();

  const { data: targetUser } = await admin
    .from("user_profiles")
    .select("id, company_id, department_id")
    .eq("id", userId)
    .maybeSingle();

  if (
    !targetUser ||
    !canAccessScopedProfile(auth, {
      company_id: targetUser.company_id,
      department_id: targetUser.department_id,
    })
  ) {
    return { error: "No tienes permisos para editar este usuario." };
  }

  if (!rotationGroupId) {
    const { error } = await admin
      .from("user_rotation_assignments")
      .delete()
      .eq("user_id", userId);

    if (error) return { error: error.message };

    revalidatePath("/admin/schedule-config");
    revalidatePath("/calendar");
    revalidatePath("/profile");
    return { success: true };
  }

  if (!targetUser.company_id || !targetUser.department_id) {
    return { error: "El usuario no tiene empresa o departamento configurado." };
  }

  const { data: targetDepartments } = await admin
    .from("departments")
    .select("id, company_id, name, parent_department_id, is_assignable, created_at")
    .eq("company_id", targetUser.company_id);
  const targetArea = getDepartmentArea(
    (targetDepartments ?? []) as Department[],
    targetUser.department_id
  );

  if (!targetArea) {
    return { error: "El usuario no tiene un area operativa configurada." };
  }

  const { data: areaScheduleConfig } = await admin
    .from("area_schedule_configs")
    .select("schedule_type")
    .eq("department_id", targetArea.id)
    .maybeSingle();

  if (areaScheduleConfig?.schedule_type !== "3t5") {
    return { error: "Solo puedes asignar grupo a usuarios con jornada 3T5." };
  }

  const { data: rotationGroup } = await admin
    .from("rotation_groups")
    .select("id")
    .eq("id", rotationGroupId)
    .maybeSingle();

  if (!rotationGroup) {
    return { error: "El grupo de rotacion seleccionado no existe." };
  }

  const { error } = await admin
    .from("user_rotation_assignments")
    .upsert(
      { user_id: userId, rotation_group_id: rotationGroupId },
      { onConflict: "user_id" }
    );

  if (error) return { error: error.message };

  revalidatePath("/admin/schedule-config");
  revalidatePath("/calendar");
  revalidatePath("/profile");
  return { success: true };
}
