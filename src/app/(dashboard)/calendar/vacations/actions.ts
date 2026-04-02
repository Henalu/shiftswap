"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface VacationMutationResult {
  success?: true;
  error?: string;
}

export async function createVacation(
  _prevState: VacationMutationResult,
  formData: FormData
): Promise<VacationMutationResult> {
  const startDate = formData.get("start_date") as string;
  const endDate = formData.get("end_date") as string;
  const notes = (formData.get("notes") as string) || null;

  if (!startDate || !endDate) {
    return { error: "Indica las fechas de inicio y fin de las vacaciones." };
  }

  if (endDate < startDate) {
    return { error: "La fecha de fin no puede ser anterior a la de inicio." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "No autorizado." };
  }

  const admin = createAdminClient();

  // Check overlap with existing vacations
  const { data: existing } = await admin
    .from("vacations")
    .select("id, start_date, end_date")
    .eq("user_id", user.id)
    .lte("start_date", endDate)
    .gte("end_date", startDate);

  if (existing && existing.length > 0) {
    return {
      error: "Ya tienes vacaciones registradas que se solapan con estas fechas.",
    };
  }

  const { error } = await admin.from("vacations").insert({
    user_id: user.id,
    start_date: startDate,
    end_date: endDate,
    notes,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/calendar");
  revalidatePath("/calendar/vacations");
  return { success: true };
}

export async function deleteVacation(
  vacationId: string
): Promise<VacationMutationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "No autorizado." };
  }

  const admin = createAdminClient();

  // Verify ownership + future date
  const { data: vacation } = await admin
    .from("vacations")
    .select("id, user_id, start_date")
    .eq("id", vacationId)
    .maybeSingle();

  if (!vacation) {
    return { error: "Vacaciones no encontradas." };
  }

  if (vacation.user_id !== user.id) {
    return { error: "No puedes eliminar vacaciones de otro usuario." };
  }

  const today = new Date().toISOString().slice(0, 10);
  if (vacation.start_date < today) {
    return { error: "No puedes eliminar vacaciones que ya han comenzado." };
  }

  const { error } = await admin
    .from("vacations")
    .delete()
    .eq("id", vacationId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/calendar");
  revalidatePath("/calendar/vacations");
  return { success: true };
}
