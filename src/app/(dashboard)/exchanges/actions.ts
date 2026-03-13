"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications";

export interface ExchangeMutationResult {
  success?: true;
  error?: string;
}

interface ExchangeParticipantRow {
  id: string;
  shift_id: string;
  user_a_id: string;
  user_b_id: string;
  status: string;
  cancellation_requested_by: string | null;
  cancellation_requested_at: string | null;
}

function revalidateExchangeViews(exchangeId: string, shiftId: string) {
  revalidatePath("/exchanges");
  revalidatePath(`/exchanges/${exchangeId}`);
  revalidatePath(`/shifts/${shiftId}`);
  revalidatePath("/shifts/my");
}

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
    data: {
      exchange_id: exchangeId,
      shift_id: exchange.shift_id,
      action_url: `/exchanges/${exchangeId}`,
    },
  });

  revalidateExchangeViews(exchangeId, exchange.shift_id);
}

export async function attachExchangeDocument(
  formData: FormData
): Promise<ExchangeMutationResult> {
  const exchangeId = formData.get("exchange_id") as string;
  const file = formData.get("document");

  if (!exchangeId) return { error: "Intercambio inválido." };
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecciona un PDF para adjuntar." };
  }

  const fileName = file.name.toLowerCase();
  const isPdf =
    file.type === "application/pdf" || fileName.endsWith(".pdf");

  if (!isPdf) {
    return { error: "Solo se permiten archivos PDF." };
  }

  if (file.size > 10 * 1024 * 1024) {
    return { error: "El PDF no puede superar los 10 MB." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "No autenticado." };

  const { data: exchange } = await supabase
    .from("exchanges")
    .select(
      "id, shift_id, user_a_id, user_b_id, status, signed_by_user_a_at, signed_by_user_b_at"
    )
    .eq("id", exchangeId)
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .eq("status", "confirmed")
    .single();

  if (!exchange) {
    return {
      error:
        "Solo puedes adjuntar un PDF en intercambios confirmados en los que participas.",
    };
  }

  const path = `${exchangeId}/document.pdf`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("exchange-documents")
    .upload(path, bytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    return { error: `No se pudo subir el PDF: ${uploadError.message}` };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("exchange-documents").getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("exchanges")
    .update({
      document_url: `${publicUrl}?t=${Date.now()}`,
      signed_by_user_a_at: null,
      signed_by_user_b_at: null,
      status: "confirmed",
    })
    .eq("id", exchangeId);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidateExchangeViews(exchangeId, exchange.shift_id);

  return { success: true };
}

export async function signExchange(
  formData: FormData
): Promise<ExchangeMutationResult> {
  const exchangeId = formData.get("exchange_id") as string;
  if (!exchangeId) return { error: "Intercambio inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "No autenticado." };

  const { data: exchange } = await supabase
    .from("exchanges")
    .select(
      `
      id, shift_id, user_a_id, user_b_id, status, document_url,
      signed_by_user_a_at, signed_by_user_b_at
    `
    )
    .eq("id", exchangeId)
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .eq("status", "confirmed")
    .single();

  if (!exchange) {
    return { error: "Este intercambio ya no admite nuevas firmas." };
  }

  if (!exchange.document_url) {
    return { error: "Adjunta primero un PDF para poder firmar." };
  }

  const now = new Date().toISOString();
  const isUserA = user.id === exchange.user_a_id;
  const alreadySigned = isUserA
    ? exchange.signed_by_user_a_at
    : exchange.signed_by_user_b_at;

  if (alreadySigned) {
    return { success: true };
  }

  const updatePayload = isUserA
    ? { signed_by_user_a_at: now }
    : { signed_by_user_b_at: now };

  const { error: signError } = await supabase
    .from("exchanges")
    .update(updatePayload)
    .eq("id", exchangeId);

  if (signError) {
    return { error: signError.message };
  }

  const { data: latestExchange } = await supabase
    .from("exchanges")
    .select("status, signed_by_user_a_at, signed_by_user_b_at")
    .eq("id", exchangeId)
    .single();

  if (
    latestExchange &&
    latestExchange.status === "confirmed" &&
    latestExchange.signed_by_user_a_at &&
    latestExchange.signed_by_user_b_at
  ) {
    await supabase
      .from("exchanges")
      .update({ status: "signed" })
      .eq("id", exchangeId)
      .eq("status", "confirmed");

    const otherUserId = isUserA ? exchange.user_b_id : exchange.user_a_id;
    await createNotification({
      userId: otherUserId,
      type: "exchange_confirmed",
      title: "Intercambio firmado",
      body: "Ambas partes han firmado el intercambio de turno.",
      data: {
        exchange_id: exchangeId,
        shift_id: exchange.shift_id,
        action_url: `/exchanges/${exchangeId}`,
      },
    });
  }

  revalidateExchangeViews(exchangeId, exchange.shift_id);

  return { success: true };
}

export async function requestSignedExchangeCancellation(
  formData: FormData
): Promise<void> {
  const exchangeId = formData.get("exchange_id") as string;
  if (!exchangeId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { data: exchange } = await supabase
    .from("exchanges")
    .select(
      "id, shift_id, user_a_id, user_b_id, status, cancellation_requested_by, cancellation_requested_at"
    )
    .eq("id", exchangeId)
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .eq("status", "signed")
    .single();

  const typedExchange = exchange as ExchangeParticipantRow | null;

  if (!typedExchange) return;

  if (typedExchange.cancellation_requested_by) {
    revalidateExchangeViews(exchangeId, typedExchange.shift_id);
    return;
  }

  const requestedAt = new Date().toISOString();

  const { error } = await supabase
    .from("exchanges")
    .update({
      cancellation_requested_by: user.id,
      cancellation_requested_at: requestedAt,
    })
    .eq("id", exchangeId)
    .eq("status", "signed")
    .is("cancellation_requested_by", null);

  if (error) return;

  const otherUserId =
    user.id === typedExchange.user_a_id
      ? typedExchange.user_b_id
      : typedExchange.user_a_id;

  await createNotification({
    userId: otherUserId,
    type: "exchange_confirmed",
    title: "Solicitud de cancelación enviada",
    body: "La otra parte ha solicitado cancelar un intercambio ya firmado.",
    data: {
      exchange_id: exchangeId,
      shift_id: typedExchange.shift_id,
      action_url: `/exchanges/${exchangeId}`,
    },
  });

  revalidateExchangeViews(exchangeId, typedExchange.shift_id);
}

export async function confirmSignedExchangeCancellation(
  formData: FormData
): Promise<void> {
  const exchangeId = formData.get("exchange_id") as string;
  if (!exchangeId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { data: exchange } = await supabase
    .from("exchanges")
    .select(
      "id, shift_id, user_a_id, user_b_id, status, cancellation_requested_by, cancellation_requested_at"
    )
    .eq("id", exchangeId)
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .eq("status", "signed")
    .not("cancellation_requested_by", "is", null)
    .single();

  const typedExchange = exchange as ExchangeParticipantRow | null;

  if (
    !typedExchange ||
    !typedExchange.cancellation_requested_by ||
    typedExchange.cancellation_requested_by === user.id
  ) {
    return;
  }

  const requesterUserId = typedExchange.cancellation_requested_by;

  const { error: cancelError } = await supabase
    .from("exchanges")
    .update({
      status: "cancelled",
      cancellation_requested_by: null,
      cancellation_requested_at: null,
    })
    .eq("id", exchangeId)
    .eq("status", "signed")
    .eq("cancellation_requested_by", typedExchange.cancellation_requested_by);

  if (cancelError) return;

  await supabase
    .from("shifts")
    .update({ status: "cancelled" })
    .eq("id", typedExchange.shift_id);

  await createNotification({
    userId: requesterUserId,
    type: "exchange_confirmed",
    title: "Cancelación confirmada",
    body: "La otra parte ha aceptado cancelar el intercambio firmado.",
    data: {
      exchange_id: exchangeId,
      shift_id: typedExchange.shift_id,
      action_url: `/exchanges/${exchangeId}`,
    },
  });

  revalidateExchangeViews(exchangeId, typedExchange.shift_id);
  revalidatePath("/shifts");
}

export async function rejectSignedExchangeCancellation(
  formData: FormData
): Promise<void> {
  const exchangeId = formData.get("exchange_id") as string;
  if (!exchangeId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { data: exchange } = await supabase
    .from("exchanges")
    .select(
      "id, shift_id, user_a_id, user_b_id, status, cancellation_requested_by, cancellation_requested_at"
    )
    .eq("id", exchangeId)
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .eq("status", "signed")
    .not("cancellation_requested_by", "is", null)
    .single();

  const typedExchange = exchange as ExchangeParticipantRow | null;

  if (
    !typedExchange ||
    !typedExchange.cancellation_requested_by ||
    typedExchange.cancellation_requested_by === user.id
  ) {
    return;
  }

  const requesterUserId = typedExchange.cancellation_requested_by;

  const { error } = await supabase
    .from("exchanges")
    .update({
      cancellation_requested_by: null,
      cancellation_requested_at: null,
    })
    .eq("id", exchangeId)
    .eq("status", "signed")
    .eq("cancellation_requested_by", typedExchange.cancellation_requested_by);

  if (error) return;

  await createNotification({
    userId: requesterUserId,
    type: "exchange_confirmed",
    title: "Solicitud de cancelación rechazada",
    body: "La otra parte ha rechazado cancelar el intercambio firmado.",
    data: {
      exchange_id: exchangeId,
      shift_id: typedExchange.shift_id,
      action_url: `/exchanges/${exchangeId}`,
    },
  });

  revalidateExchangeViews(exchangeId, typedExchange.shift_id);
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
    data: {
      exchange_id: exchangeId,
      shift_id: exchange.shift_id,
      action_url: `/exchanges/${exchangeId}`,
    },
  });

  revalidateExchangeViews(exchangeId, exchange.shift_id);
  revalidatePath("/shifts");
}
