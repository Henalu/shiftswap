"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications";

export async function confirmExchange(formData: FormData): Promise<void> {
  const exchangeId = formData.get("exchange_id") as string;
  if (!exchangeId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  // Only user_b (the requester) can confirm
  const { data: exchange } = await supabase
    .from("exchanges")
    .select("id, shift_id, user_a_id, user_b_id, status")
    .eq("id", exchangeId)
    .eq("user_b_id", user.id)
    .eq("status", "pending_confirmation")
    .single();

  if (!exchange) return;

  await supabase
    .from("exchanges")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", exchangeId);

  await supabase
    .from("shifts")
    .update({ status: "confirmed" })
    .eq("id", exchange.shift_id);

  await createNotification({
    userId: exchange.user_a_id,
    type: "exchange_confirmed",
    title: "Intercambio confirmado",
    body: "El otro empleado ha confirmado el intercambio de turno.",
    data: { exchange_id: exchangeId, shift_id: exchange.shift_id },
  });

  revalidatePath("/exchanges");
  revalidatePath(`/exchanges/${exchangeId}`);
  revalidatePath("/shifts/my");
}

export async function cancelExchange(formData: FormData): Promise<void> {
  const exchangeId = formData.get("exchange_id") as string;
  if (!exchangeId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  // Either participant can cancel
  const { data: exchange } = await supabase
    .from("exchanges")
    .select("id, shift_id, user_a_id, user_b_id, status")
    .eq("id", exchangeId)
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .in("status", ["pending_confirmation", "confirmed"])
    .single();

  if (!exchange) return;

  await supabase
    .from("exchanges")
    .update({ status: "cancelled" })
    .eq("id", exchangeId);

  if (exchange.status === "pending_confirmation") {
    // Revert shift to open and the accepted request back to pending
    await supabase
      .from("shifts")
      .update({ status: "open" })
      .eq("id", exchange.shift_id);

    await supabase
      .from("shift_requests")
      .update({ status: "pending" })
      .eq("shift_id", exchange.shift_id)
      .eq("interested_user_id", exchange.user_b_id)
      .eq("status", "accepted");
  } else {
    // confirmed → cancelled
    await supabase
      .from("shifts")
      .update({ status: "cancelled" })
      .eq("id", exchange.shift_id);
  }

  // Notify the other party
  const otherUserId =
    user.id === exchange.user_a_id ? exchange.user_b_id : exchange.user_a_id;

  await createNotification({
    userId: otherUserId,
    type: "exchange_confirmed",
    title: "Intercambio cancelado",
    body: "El intercambio de turno ha sido cancelado por la otra parte.",
    data: { exchange_id: exchangeId, shift_id: exchange.shift_id },
  });

  revalidatePath("/exchanges");
  revalidatePath(`/exchanges/${exchangeId}`);
  revalidatePath("/shifts");
  revalidatePath("/shifts/my");
}
