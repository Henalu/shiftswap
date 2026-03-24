"use server";

import { revalidatePath } from "next/cache";
import { recordExchangeEvent } from "@/lib/exchange-workflow";
import { createClient } from "@/lib/supabase/server";
import {
  createNotification,
  resolveNotifications,
} from "@/lib/notifications";

function revalidateShiftViews(shiftId: string) {
  revalidatePath("/shifts");
  revalidatePath("/shifts/my");
  revalidatePath(`/shifts/${shiftId}`);
  revalidatePath("/exchanges");
}

export async function cancelShift(formData: FormData): Promise<void> {
  const shiftId = formData.get("shift_id") as string;
  if (!shiftId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const [{ data: shift }, { data: requests }] = await Promise.all([
    supabase
      .from("shifts")
      .select("id, user_id, status")
      .eq("id", shiftId)
      .eq("user_id", user.id)
      .in("status", ["open", "pending"])
      .maybeSingle(),
    supabase
      .from("shift_requests")
      .select("id, interested_user_id, status")
      .eq("shift_id", shiftId)
      .in("status", ["pending", "accepted"]),
  ]);

  if (!shift) return;

  await supabase
    .from("shifts")
    .update({ status: "cancelled" })
    .eq("id", shiftId)
    .eq("user_id", user.id)
    .in("status", ["open", "pending"]);

  await resolveNotifications({
    userId: user.id,
    types: ["shift_request"],
    dataContains: { shift_id: shiftId },
    unresolvedOnly: true,
  });

  for (const request of requests ?? []) {
    await createNotification({
      userId: request.interested_user_id,
      type: "shift_cancelled",
      title: "Turno cancelado",
      body: "El turno en el que habías mostrado interés ya no está disponible.",
      dedupeKey: `shift_cancelled:${shiftId}`,
      data: {
        shift_id: shiftId,
        request_id: request.id,
        action_url: `/shifts/${shiftId}`,
      },
    });

    await resolveNotifications({
      userId: request.interested_user_id,
      types: ["request_accepted"],
      dataContains: { shift_id: shiftId },
      unresolvedOnly: true,
    });
  }

  revalidateShiftViews(shiftId);
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

  const { data: shift } = await supabase
    .from("shifts")
    .select("user_id, status, department_id")
    .eq("id", shiftId)
    .single();

  if (!shift || shift.user_id !== user.id || shift.status !== "open") return;

  const { data: activeExchange } = await supabase
    .from("exchanges")
    .select("id")
    .eq("shift_id", shiftId)
    .in("status", [
      "pending_confirmation",
      "confirmed",
      "pending_department_approval",
      "approved",
      "completed",
    ])
    .limit(1)
    .maybeSingle();

  if (activeExchange) return;

  const { data: request } = await supabase
    .from("shift_requests")
    .select("id, interested_user_id")
    .eq("id", requestId)
    .single();

  if (!request) return;

  const { data: requesterProfile } = await supabase
    .from("user_profiles")
    .select("department_id")
    .eq("id", request.interested_user_id)
    .maybeSingle();

  if (!requesterProfile || requesterProfile.department_id !== shift.department_id) {
    return;
  }

  await supabase
    .from("shift_requests")
    .update({ status: "accepted" })
    .eq("id", requestId);

  await supabase.from("shifts").update({ status: "pending" }).eq("id", shiftId);

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

  if (exchangeId) {
    await recordExchangeEvent({
      exchangeId,
      actorId: user.id,
      eventType: "exchange_created",
      title: "Intercambio iniciado",
      details: "El propietario ha aceptado la solicitud y se abre el expediente del cambio.",
      toStatus: "pending_confirmation",
    });
  }

  await createNotification({
    userId: request.interested_user_id,
    type: "request_accepted",
    title: "Tu solicitud fue aceptada",
    body: "El propietario del turno ha aceptado tu solicitud. Ya puedes revisar el intercambio.",
    dedupeKey: `request_accepted:${exchangeId ?? requestId}`,
    data: {
      shift_id: shiftId,
      request_id: requestId,
      exchange_id: exchangeId ?? undefined,
      action_url: exchangeId ? `/exchanges/${exchangeId}` : "/exchanges",
    },
  });

  await resolveNotifications({
    userId: user.id,
    dedupeKey: `shift_request:${requestId}`,
    unresolvedOnly: true,
  });

  revalidateShiftViews(shiftId);
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

  const { data: shift } = await supabase
    .from("shifts")
    .select("user_id")
    .eq("id", shiftId)
    .single();

  if (!shift || shift.user_id !== user.id) return;

  const { data: request } = await supabase
    .from("shift_requests")
    .select("id, interested_user_id")
    .eq("id", requestId)
    .single();

  if (!request) return;

  await supabase
    .from("shift_requests")
    .update({ status: "rejected" })
    .eq("id", requestId);

  const { data: accepted } = await supabase
    .from("shift_requests")
    .select("id")
    .eq("shift_id", shiftId)
    .eq("status", "accepted");

  if (!accepted || accepted.length === 0) {
    await supabase.from("shifts").update({ status: "open" }).eq("id", shiftId);
  }

  await createNotification({
    userId: request.interested_user_id,
    type: "request_rejected",
    title: "Tu solicitud no fue aceptada",
    body: "El propietario del turno no ha podido aceptar tu solicitud en este momento.",
    dedupeKey: `request_rejected:${requestId}`,
    data: {
      shift_id: shiftId,
      request_id: requestId,
      action_url: `/shifts/${shiftId}`,
    },
  });

  await resolveNotifications({
    userId: user.id,
    dedupeKey: `shift_request:${requestId}`,
    unresolvedOnly: true,
  });

  revalidatePath("/shifts/my");
  revalidatePath(`/shifts/${shiftId}`);
}
