"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications";
import { formatShortDate } from "@/lib/utils";

export async function showInterest(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const shiftId = formData.get("shift_id") as string;

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

  const { error } = await supabase.from("shift_requests").insert({
    shift_id: shiftId,
    interested_user_id: user.id,
    status: "pending",
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya has mostrado interés en este turno." };
    }
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
  return null;
}
