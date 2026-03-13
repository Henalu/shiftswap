"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications";
import { formatShortDate } from "@/lib/utils";

export interface InterestState {
  error?: string;
  success?: boolean;
  interested?: boolean;
  requestId?: string | null;
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

  // Withdraw existing interest
  if (requestId) {
    const { error } = await supabase
      .from("shift_requests")
      .update({ status: "withdrawn" })
      .eq("id", requestId)
      .eq("interested_user_id", user.id);

    if (error) return { error: error.message };

    revalidatePath("/shifts");
    revalidatePath(`/shifts/${shiftId}`);
    return { success: true, interested: false, requestId: null };
  }

  // Re-apply: if a withdrawn row exists for this user+shift, reactivate it
  // (avoids UNIQUE(shift_id, interested_user_id) 23505 on INSERT)
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

    revalidatePath("/shifts");
    revalidatePath(`/shifts/${shiftId}`);
    return { success: true, interested: true, requestId: withdrawn.id };
  }

  // Fresh insert
  const { data: newRequest, error } = await supabase
    .from("shift_requests")
    .insert({ shift_id: shiftId, interested_user_id: user.id, status: "pending" })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  // Notify the shift owner
  const { data: shift } = await supabase
    .from("shifts")
    .select("user_id, date")
    .eq("id", shiftId)
    .single();

  const { data: interestedProfile } = await supabase
    .from("user_profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  if (shift && interestedProfile) {
    await createNotification({
      userId: shift.user_id,
      type: "shift_request",
      title: "Nuevo interesado en tu turno",
      body: `${interestedProfile.full_name} está interesado en tu turno del ${formatShortDate(shift.date)}.`,
      data: { shift_id: shiftId },
    });
  }

  revalidatePath("/shifts");
  revalidatePath(`/shifts/${shiftId}`);
  return { success: true, interested: true, requestId: newRequest.id };
}
