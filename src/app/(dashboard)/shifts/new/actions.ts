"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ShiftType } from "@/types";

export interface CreateShiftState {
  error?: string;
}

export async function createShift(
  _prevState: CreateShiftState,
  formData: FormData
): Promise<CreateShiftState> {
  const date = formData.get("date") as string;
  const shiftType = formData.get("shift_type") as ShiftType;
  const startTime = formData.get("start_time") as string;
  const endTime = formData.get("end_time") as string;
  const description = (formData.get("description") as string) || null;

  if (!date || !shiftType || !startTime || !endTime) {
    return { error: "Todos los campos obligatorios deben estar rellenados." };
  }

  const validShiftTypes: ShiftType[] = ["morning", "afternoon", "night"];
  if (!validShiftTypes.includes(shiftType)) {
    return { error: "Tipo de turno no válido." };
  }

  // Verify the authenticated user matches the submitted userId (RLS double-check)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "No autorizado." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("department_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return { error: "No se pudo validar tu departamento actual." };
  }

  if (!profile?.department_id) {
    return {
      error:
        "Tu perfil no tiene un departamento operativo asignado. Revisa tu perfil antes de publicar un turno.",
    };
  }

  const [{ data: department, error: departmentError }, { data: childDepartments, error: childDepartmentsError }] =
    await Promise.all([
      supabase
        .from("departments")
        .select("id, is_assignable")
        .eq("id", profile.department_id)
        .maybeSingle(),
      supabase
        .from("departments")
        .select("id")
        .eq("parent_department_id", profile.department_id)
        .limit(1),
    ]);

  if (departmentError || childDepartmentsError) {
    return { error: "No se pudo validar tu departamento operativo." };
  }

  if (!department?.is_assignable || (childDepartments?.length ?? 0) > 0) {
    return {
      error:
        "Tu cuenta sigue asociada a un area general. Necesitas un departamento operativo final para publicar turnos.",
    };
  }

  const { error } = await supabase.from("shifts").insert({
    user_id: user.id,
    department_id: profile.department_id,
    date,
    start_time: startTime,
    end_time: endTime,
    shift_type: shiftType,
    description: description || undefined,
    status: "open",
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/shifts");
  revalidatePath("/shifts/my");
  redirect("/shifts/my");
}
