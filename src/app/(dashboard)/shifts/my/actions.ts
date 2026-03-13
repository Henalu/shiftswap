"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications";

export async function cancelShift(formData: FormData): Promise<void> {
  const shiftId = formData.get("shift_id") as string;
  if (!shiftId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase
    .from("shifts")
    .update({ status: "cancelled" })
    .eq("id", shiftId)
    .eq("user_id", user.id)
    .in("status", ["open", "pending"]);

  revalidatePath("/shifts");
  revalidatePath("/shifts/my");
}

export async function acceptRequest(formData: FormData): Promise<void> {
  const requestId = formData.get("request_id") as string;
  const shiftId = formData.get("shift_id") as string;

  if (!requestId || !shiftId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  // Verify the shift belongs to the current user
  const { data: shift } = await supabase
    .from("shifts")
    .select("user_id, status")
    .eq("id", shiftId)
    .single();

  if (!shift || shift.user_id !== user.id || shift.status !== "open") return;

  const { data: activeExchange } = await supabase
    .from("exchanges")
    .select("id")
    .eq("shift_id", shiftId)
    .in("status", ["pending_confirmation", "confirmed", "signed", "completed"])
    .limit(1)
    .maybeSingle();

  if (activeExchange) return;

  // Fetch the request to get the interested user id
  const { data: request } = await supabase
    .from("shift_requests")
    .select("interested_user_id")
    .eq("id", requestId)
    .single();

  await supabase
    .from("shift_requests")
    .update({ status: "accepted" })
    .eq("id", requestId);

  await supabase
    .from("shifts")
    .update({ status: "pending" })
    .eq("id", shiftId);

  // Create exchange record (pending_confirmation) if it doesn't already exist
  if (request) {
    const { data: existingExchange } = await supabase
      .from("exchanges")
      .select("id")
      .eq("shift_id", shiftId)
      .eq("user_b_id", request.interested_user_id)
      .neq("status", "cancelled")
      .maybeSingle();

    let exchangeId = existingExchange?.id ?? null;

    if (!existingExchange) {
      const { data: createdExchange } = await supabase
        .from("exchanges")
        .insert({
          shift_id: shiftId,
          user_a_id: user.id,
          user_b_id: request.interested_user_id,
          status: "pending_confirmation",
        })
        .select("id")
        .single();

      exchangeId = createdExchange?.id ?? null;
    }

    await createNotification({
      userId: request.interested_user_id,
      type: "request_accepted",
      title: "Tu solicitud fue aceptada",
      body: "El propietario del turno ha aceptado tu solicitud. Confirma el intercambio en /exchanges.",
      data: {
        shift_id: shiftId,
        exchange_id: exchangeId ?? undefined,
        action_url: exchangeId ? `/exchanges/${exchangeId}` : "/exchanges",
      },
    });
  }

  revalidatePath("/shifts");
  revalidatePath("/shifts/my");
  revalidatePath(`/shifts/${shiftId}`);
  revalidatePath("/exchanges");
}

export async function rejectRequest(formData: FormData): Promise<void> {
  const requestId = formData.get("request_id") as string;
  const shiftId = formData.get("shift_id") as string;

  if (!requestId || !shiftId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  // Verify the shift belongs to the current user
  const { data: shift } = await supabase
    .from("shifts")
    .select("user_id")
    .eq("id", shiftId)
    .single();

  if (!shift || shift.user_id !== user.id) return;

  // Fetch the request to get the interested user id
  const { data: request } = await supabase
    .from("shift_requests")
    .select("interested_user_id")
    .eq("id", requestId)
    .single();

  await supabase
    .from("shift_requests")
    .update({ status: "rejected" })
    .eq("id", requestId);

  // If no accepted requests remain, revert shift to open
  const { data: accepted } = await supabase
    .from("shift_requests")
    .select("id")
    .eq("shift_id", shiftId)
    .eq("status", "accepted");

  if (!accepted || accepted.length === 0) {
    await supabase
      .from("shifts")
      .update({ status: "open" })
      .eq("id", shiftId);
  }

  // Notify the interested user
  if (request) {
    await createNotification({
      userId: request.interested_user_id,
      type: "request_rejected",
      title: "Tu solicitud no fue aceptada",
      body: "El propietario del turno no ha podido aceptar tu solicitud en este momento.",
      data: {
        shift_id: shiftId,
        action_url: `/shifts/${shiftId}`,
      },
    });
  }

  revalidatePath("/shifts/my");
  revalidatePath(`/shifts/${shiftId}`);
}
