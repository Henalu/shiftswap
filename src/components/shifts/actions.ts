"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createNotification, resolveNotifications } from "@/lib/notifications";
import { formatShortDate } from "@/lib/utils";

export interface InterestState {
  error?: string;
  success?: boolean;
  interested?: boolean;
  requestId?: string | null;
}

async function notifyShiftOwnerOfInterest(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shiftId: string,
  interestedUserId: string,
  requestId: string
) {
  const [{ data: shift }, { data: interestedProfile }] = await Promise.all([
    supabase
      .from("shifts")
      .select("user_id, date")
      .eq("id", shiftId)
      .single(),
    supabase
      .from("user_profiles")
      .select("full_name")
      .eq("id", interestedUserId)
      .single(),
  ]);

  if (!shift || !interestedProfile) return;

  await createNotification({
    userId: shift.user_id,
    type: "shift_request",
    title: "Nuevo interesado en tu turno",
    body: `${interestedProfile.full_name} está interesado en tu turno del ${formatShortDate(shift.date)}.`,
    dedupeKey: `shift_request:${requestId}`,
    data: {
      shift_id: shiftId,
      request_id: requestId,
      interested_user_id: interestedUserId,
      action_url: `/shifts/${shiftId}`,
    },
  });
}

export async function toggleInterest(
  _prevState: InterestState | null,
  formData: FormData
): Promise<InterestState> {
  const shiftId = formData.get("shift_id") as string;
  const requestId = (formData.get("request_id") as string) || null;

  if (!shiftId) {
    return { error: "Turno no especificado." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes iniciar sesión." };
  }

  if (requestId) {
    const [{ error }, { data: shift }] = await Promise.all([
      supabase
        .from("shift_requests")
        .update({ status: "withdrawn" })
        .eq("id", requestId)
        .eq("interested_user_id", user.id),
      supabase
        .from("shifts")
        .select("user_id")
        .eq("id", shiftId)
        .single(),
    ]);

    if (error) return { error: error.message };

    if (shift) {
      await resolveNotifications({
        userId: shift.user_id,
        dedupeKey: `shift_request:${requestId}`,
        unresolvedOnly: true,
      });
    }

    revalidatePath("/shifts");
    revalidatePath(`/shifts/${shiftId}`);
    return { success: true, interested: false, requestId: null };
  }

  const [{ data: profile }, { data: shift }] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("department_id")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("shifts")
      .select("id, user_id, department_id, status")
      .eq("id", shiftId)
      .maybeSingle(),
  ]);

  if (!profile?.department_id) {
    return {
      error:
        "Tu perfil no tiene un departamento operativo valido. Revisa tu asignacion antes de continuar.",
    };
  }

  if (!shift || shift.user_id === user.id || shift.status !== "open") {
    return { error: "Este turno ya no esta disponible para solicitar." };
  }

  if (shift.department_id !== profile.department_id) {
    return {
      error: "Solo puedes mostrar interes en turnos de tu propio departamento.",
    };
  }

  const { data: withdrawn } = await supabase
    .from("shift_requests")
    .select("id")
    .eq("shift_id", shiftId)
    .eq("interested_user_id", user.id)
    .eq("status", "withdrawn")
    .maybeSingle();

  if (withdrawn) {
    const { error: reactivateError } = await supabase
      .from("shift_requests")
      .update({ status: "pending" })
      .eq("id", withdrawn.id);

    if (reactivateError) return { error: reactivateError.message };

    await notifyShiftOwnerOfInterest(supabase, shiftId, user.id, withdrawn.id);

    revalidatePath("/shifts");
    revalidatePath(`/shifts/${shiftId}`);
    return { success: true, interested: true, requestId: withdrawn.id };
  }

  const { data: newRequest, error } = await supabase
    .from("shift_requests")
    .insert({
      shift_id: shiftId,
      interested_user_id: user.id,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  await notifyShiftOwnerOfInterest(supabase, shiftId, user.id, newRequest.id);

  revalidatePath("/shifts");
  revalidatePath(`/shifts/${shiftId}`);
  return { success: true, interested: true, requestId: newRequest.id };
}
