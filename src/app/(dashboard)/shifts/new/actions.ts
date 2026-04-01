"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SHIFT_TYPE_LABELS } from "@/lib/constants";
import {
  getShiftSchedule,
  isShiftType,
  matchesShiftSchedule,
} from "@/lib/shifts";
import { requireSignature } from "@/lib/user-profiles";
import { createClient } from "@/lib/supabase/server";

export interface CreateShiftState {
  error?: string;
}

export async function createShift(
  _prevState: CreateShiftState,
  formData: FormData
): Promise<CreateShiftState> {
  const date = formData.get("date") as string;
  const shiftType = formData.get("shift_type") as string;
  const submittedStartTime = formData.get("start_time") as string | null;
  const submittedEndTime = formData.get("end_time") as string | null;
  const description = (formData.get("description") as string) || null;
  const acceptedModalities = formData.getAll("accepted_modalities") as string[];

  if (!date || !shiftType) {
    return {
      error: "Completa la fecha y el tipo de turno para poder publicarlo.",
    };
  }

  const validModalities = acceptedModalities.filter(
    (m) => m === "hours_bank" || m === "shift_exchange"
  );

  if (validModalities.length === 0) {
    return {
      error: "Selecciona al menos una modalidad de compensacion.",
    };
  }

  if (!isShiftType(shiftType)) {
    return { error: "Selecciona un tipo de turno valido." };
  }

  const schedule = getShiftSchedule(shiftType);

  if (
    (submittedStartTime || submittedEndTime) &&
    !matchesShiftSchedule(shiftType, submittedStartTime, submittedEndTime)
  ) {
    return {
      error: `El turno de ${SHIFT_TYPE_LABELS[
        shiftType
      ].toLowerCase()} usa siempre el horario ${schedule.startTime} - ${
        schedule.endTime
      }. Vuelve a elegir el tipo de turno para recalcularlo.`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "No autorizado." };
  }

  const signatureCheck = await requireSignature(user.id);
  if (signatureCheck.error) return { error: signatureCheck.error };

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

  const [
    { data: department, error: departmentError },
    { data: childDepartments, error: childDepartmentsError },
  ] = await Promise.all([
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
    // The stored schedule is derived from shift_type to prevent invalid mixes.
    start_time: schedule.startTime,
    end_time: schedule.endTime,
    shift_type: shiftType,
    description: description || undefined,
    accepted_modalities: validModalities,
    status: "open",
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/shifts");
  revalidatePath("/shifts/my");
  redirect("/shifts/my");
}
