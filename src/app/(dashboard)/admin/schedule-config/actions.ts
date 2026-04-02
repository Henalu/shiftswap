"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasAdminPanelAccess } from "@/lib/user-roles";
import type { UserRole } from "@/types";

export interface ScheduleConfigResult {
  success?: true;
  error?: string;
}

async function requireAdmin(): Promise<{ userId: string; role: UserRole } | ScheduleConfigResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "No autorizado." };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !hasAdminPanelAccess(profile.role as UserRole)) {
    return { error: "No tienes permisos para esta accion." };
  }

  return { userId: user.id, role: profile.role as UserRole };
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
  if ("error" in auth) return auth;

  const admin = createAdminClient();

  // Upsert area schedule config
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
  const rotationGroupId = formData.get("rotation_group_id") as string;

  if (!userId || !rotationGroupId) {
    return { error: "Faltan datos obligatorios." };
  }

  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const admin = createAdminClient();

  const { error } = await admin
    .from("user_rotation_assignments")
    .upsert(
      { user_id: userId, rotation_group_id: rotationGroupId },
      { onConflict: "user_id" }
    );

  if (error) return { error: error.message };

  revalidatePath("/admin/schedule-config");
  revalidatePath("/calendar");
  return { success: true };
}
