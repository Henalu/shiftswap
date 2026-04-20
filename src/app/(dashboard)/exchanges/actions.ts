"use server";

import { revalidatePath } from "next/cache";
import {
  EXCHANGE_DOCUMENT_MAX_SIZE,
  getExchangeDocumentKind,
  getExchangeDocumentStoragePath,
} from "@/lib/exchange-documents";
import {
  getScopedExchangeApproverIds,
  recordExchangeEvent,
} from "@/lib/exchange-workflow";
import {
  getAgreementSummary,
} from "@/lib/exchange-compensation";
import {
  syncHoursBankDebtTransactionStatus,
  upsertHoursBankDebtTransaction,
} from "@/lib/exchange-compensation-server";
import { requireSignature } from "@/lib/user-profiles";
import { createClient } from "@/lib/supabase/server";
import { createNotification, resolveNotifications } from "@/lib/notifications";
import type { ExchangeAgreementType, ExchangeStatus, ShiftType } from "@/types";

export interface ExchangeMutationResult {
  success?: true;
  error?: string;
}

interface ExchangeParticipantRow {
  id: string;
  shift_id: string;
  user_a_id: string;
  user_b_id: string;
  status: ExchangeStatus;
  agreement_type?: ExchangeAgreementType | null;
  compensation_shift_date?: string | null;
  compensation_shift_type?: ShiftType | "rest" | null;
  cancellation_requested_by: string | null;
  cancellation_requested_at: string | null;
  signed_by_user_b_at?: string | null;
}

interface ShiftScopeRow {
  department_id: string;
  department: {
    company_id: string;
  } | null;
}

function revalidateExchangeViews(exchangeId: string, shiftId: string) {
  revalidatePath("/exchanges");
  revalidatePath(`/exchanges/${exchangeId}`);
  revalidatePath(`/shifts/${shiftId}`);
  revalidatePath("/shifts");
  revalidatePath("/shifts/my");
  revalidatePath("/chat");
  revalidatePath("/admin");
  revalidatePath("/admin/exchanges");
}

async function resolveExchangeInbox(
  exchangeId: string,
  userIds: string[]
): Promise<void> {
  await resolveNotifications({
    userIds,
    types: [
      "proposal_accepted",
      "exchange_signed",
      "exchange_document_added",
      "exchange_cancellation_requested",
      "exchange_pending_validation",
      "exchange_department_approved",
      "exchange_department_rejected",
    ],
    dataContains: { exchange_id: exchangeId },
    unresolvedOnly: true,
  });
}

async function reopenShiftAfterExchangeReset(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shiftId: string
): Promise<void> {
  await supabase.from("shifts").update({ status: "open" }).eq("id", shiftId);
}

async function getShiftScope(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shiftId: string
): Promise<{ company_id: string | null; department_id: string | null }> {
  const { data } = await supabase
    .from("shifts")
    .select(
      `
      department_id,
      department:departments!department_id(company_id)
    `
    )
    .eq("id", shiftId)
    .single();

  const typed = (data as ShiftScopeRow | null) ?? null;

  return {
    company_id: typed?.department?.company_id ?? null,
    department_id: typed?.department_id ?? null,
  };
}

async function getUserFullName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from("user_profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  return data?.full_name ?? "Empleado";
}

/**
 * signAsInterested — the interested party (user_b) signs explicitly.
 * This is the only explicit signature in v2; publisher's signature is implicit at acceptance.
 */
export async function signAsInterested(
  formData: FormData
): Promise<ExchangeMutationResult> {
  const exchangeId = formData.get("exchange_id") as string;
  if (!exchangeId) return { error: "Intercambio invalido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "No autenticado." };

  const signatureCheck = await requireSignature(user.id);
  if (signatureCheck.error) return { error: signatureCheck.error };

  const { data: exchange } = await supabase
    .from("exchanges")
    .select(
      `id, shift_id, user_a_id, user_b_id, status,
       signed_by_user_b_at, agreement_type,
       compensation_shift_date, compensation_shift_type`
    )
    .eq("id", exchangeId)
    .eq("user_b_id", user.id)
    .eq("status", "accepted")
    .single();

  if (!exchange) {
    return { error: "Esta solicitud ya no admite firma." };
  }

  if (exchange.signed_by_user_b_at) {
    return { success: true };
  }

  const now = new Date().toISOString();
  const signerName = await getUserFullName(supabase, user.id);
  const ownerName = await getUserFullName(supabase, exchange.user_a_id);

  // Sign and immediately submit for validation
  const { error: signError } = await supabase
    .from("exchanges")
    .update({
      signed_by_user_b_at: now,
      signed_by_user_b_name: signerName,
      status: "pending_validation",
      submitted_for_approval_at: now,
    })
    .eq("id", exchangeId)
    .eq("status", "accepted");

  if (signError) {
    return { error: signError.message };
  }

  // Update shift status (stays negotiating — no change needed)

  const agreementSummary = getAgreementSummary({
    agreementType: exchange.agreement_type,
    compensationShiftType: exchange.compensation_shift_type,
    compensationShiftDate: exchange.compensation_shift_date,
    ownerName,
    requesterName: signerName,
  });

  await recordExchangeEvent({
    exchangeId,
    actorId: user.id,
    eventType: "interested_signed",
    title: `${signerName} ha firmado la solicitud`,
    details: agreementSummary,
  });

  await recordExchangeEvent({
    exchangeId,
    actorId: user.id,
    eventType: "submitted_for_validation",
    title: "Solicitud enviada a validacion",
    details: agreementSummary,
    fromStatus: "accepted",
    toStatus: "pending_validation",
  });

  // Create hours_bank debt if applicable
  if (exchange.agreement_type === "hours_bank") {
    await upsertHoursBankDebtTransaction({
      exchangeId,
      exchangeStatus: "pending_validation",
      debtorUserId: exchange.user_a_id,
      creditorUserId: exchange.user_b_id,
      debtorName: ownerName,
      creditorName: signerName,
    });
  }

  // Notify both participants
  const participantIds = [exchange.user_a_id, exchange.user_b_id];
  for (const participantId of participantIds) {
    await createNotification({
      userId: participantId,
      type: "exchange_pending_validation",
      title: "Solicitud enviada a validacion",
      body: "La solicitud esta firmada y queda pendiente de revision del departamento.",
      dedupeKey: `exchange_pending_validation:${exchangeId}`,
      data: {
        exchange_id: exchangeId,
        shift_id: exchange.shift_id,
        action_url: `/exchanges/${exchangeId}`,
      },
    });
  }

  // Notify approvers
  const scope = await getShiftScope(supabase, exchange.shift_id);
  const approverIds = await getScopedExchangeApproverIds(scope);

  for (const approverId of approverIds) {
    if (participantIds.includes(approverId)) continue;

    await createNotification({
      userId: approverId,
      type: "exchange_pending_validation",
      title: "Solicitud pendiente de validacion",
      body: "Hay un cambio de turno listo para revisar y resolver.",
      dedupeKey: `exchange_pending_validation:${exchangeId}`,
      data: {
        exchange_id: exchangeId,
        shift_id: exchange.shift_id,
        action_url: `/admin/exchanges`,
      },
    });
  }

  // Resolve prior notifications
  await resolveNotifications({
    userIds: participantIds,
    types: ["proposal_accepted", "exchange_document_added"],
    dataContains: { exchange_id: exchangeId },
    unresolvedOnly: true,
  });

  revalidateExchangeViews(exchangeId, exchange.shift_id);

  return { success: true };
}

export async function attachExchangeDocument(
  formData: FormData
): Promise<ExchangeMutationResult> {
  const exchangeId = formData.get("exchange_id") as string;
  const file = formData.get("document");

  if (!exchangeId) return { error: "Intercambio invalido." };
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecciona un documento para adjuntar." };
  }

  const documentKind = getExchangeDocumentKind(file);

  if (!documentKind) {
    return { error: "Solo se permiten archivos PDF o Word (.doc, .docx)." };
  }

  if (file.size > EXCHANGE_DOCUMENT_MAX_SIZE) {
    return { error: "El documento no puede superar los 10 MB." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "No autenticado." };

  const { data: exchange } = await supabase
    .from("exchanges")
    .select("id, shift_id, user_a_id, user_b_id, status")
    .eq("id", exchangeId)
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .in("status", ["accepted", "pending_validation"])
    .single();

  if (!exchange) {
    return {
      error:
        "Solo puedes adjuntar soporte en solicitudes activas en las que participas.",
    };
  }

  const path = getExchangeDocumentStoragePath(
    exchangeId,
    documentKind.extension
  );
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { data: existingDocuments } = await supabase.storage
    .from("exchange-documents")
    .list(exchangeId);

  const filesToRemove =
    existingDocuments?.map((document) => `${exchangeId}/${document.name}`) ?? [];

  if (filesToRemove.length > 0) {
    await supabase.storage.from("exchange-documents").remove(filesToRemove);
  }

  const { error: uploadError } = await supabase.storage
    .from("exchange-documents")
    .upload(path, bytes, {
      contentType: documentKind.mimeType,
      upsert: true,
    });

  if (uploadError) {
    return { error: `No se pudo subir el documento: ${uploadError.message}` };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("exchange-documents").getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("exchanges")
    .update({
      document_url: `${publicUrl}?t=${Date.now()}`,
    })
    .eq("id", exchangeId);

  if (updateError) {
    return { error: updateError.message };
  }

  const otherUserId =
    user.id === exchange.user_a_id ? exchange.user_b_id : exchange.user_a_id;

  await createNotification({
    userId: otherUserId,
    type: "exchange_document_added",
    title: "Nuevo soporte adjunto",
    body: "La otra parte ha subido o reemplazado un documento de apoyo.",
    dedupeKey: `exchange_document:${exchangeId}`,
    data: {
      exchange_id: exchangeId,
      shift_id: exchange.shift_id,
      action_url: `/exchanges/${exchangeId}`,
    },
  });

  await recordExchangeEvent({
    exchangeId,
    actorId: user.id,
    eventType: "support_document_attached",
    title: "Soporte adicional adjuntado",
    details: "Se ha subido un documento de apoyo para complementar la solicitud.",
    metadata: {
      extension: documentKind.extension,
    },
  });

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
    .eq("status", "pending_validation")
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
    .eq("status", "pending_validation")
    .is("cancellation_requested_by", null);

  if (error) return;

  const otherUserId =
    user.id === typedExchange.user_a_id
      ? typedExchange.user_b_id
      : typedExchange.user_a_id;

  await createNotification({
    userId: otherUserId,
    type: "exchange_cancellation_requested",
    title: "Solicitud de retirada",
    body: "La otra parte ha pedido retirar la solicitud antes de la decision del departamento.",
    dedupeKey: `exchange_cancellation_requested:${exchangeId}`,
    data: {
      exchange_id: exchangeId,
      shift_id: typedExchange.shift_id,
      action_url: `/exchanges/${exchangeId}`,
    },
  });

  await recordExchangeEvent({
    exchangeId,
    actorId: user.id,
    eventType: "cancellation_requested",
    title: "Retirada solicitada",
    details: "Una de las partes ha pedido cancelar la solicitud antes de la validacion.",
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
    .eq("status", "pending_validation")
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
    .eq("status", "pending_validation")
    .eq("cancellation_requested_by", typedExchange.cancellation_requested_by);

  if (cancelError) return;

  await syncHoursBankDebtTransactionStatus(exchangeId, "voided");
  await reopenShiftAfterExchangeReset(supabase, typedExchange.shift_id);

  await resolveExchangeInbox(exchangeId, [
    typedExchange.user_a_id,
    typedExchange.user_b_id,
  ]);

  await resolveNotifications({
    userId: user.id,
    dedupeKey: `exchange_cancellation_requested:${exchangeId}`,
    unresolvedOnly: true,
  });

  await createNotification({
    userId: requesterUserId,
    type: "exchange_cancelled",
    title: "Solicitud retirada",
    body: "La otra parte ha confirmado la retirada y el turno vuelve a quedar libre.",
    dedupeKey: `exchange_cancelled:${exchangeId}`,
    data: {
      exchange_id: exchangeId,
      shift_id: typedExchange.shift_id,
      action_url: `/exchanges/${exchangeId}`,
    },
  });

  await recordExchangeEvent({
    exchangeId,
    actorId: user.id,
    eventType: "exchange_cancelled",
    title: "Solicitud cancelada",
    details: "La retirada ha sido confirmada por la otra parte y el expediente se cierra.",
    fromStatus: "pending_validation",
    toStatus: "cancelled",
  });

  revalidateExchangeViews(exchangeId, typedExchange.shift_id);
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
    .eq("status", "pending_validation")
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
    .eq("status", "pending_validation")
    .eq("cancellation_requested_by", typedExchange.cancellation_requested_by);

  if (error) return;

  await resolveNotifications({
    userId: user.id,
    dedupeKey: `exchange_cancellation_requested:${exchangeId}`,
    unresolvedOnly: true,
  });

  await createNotification({
    userId: requesterUserId,
    type: "exchange_cancellation_rejected",
    title: "Retirada no aceptada",
    body: "La otra parte ha decidido mantener la solicitud activa.",
    dedupeKey: `exchange_cancellation_rejected:${exchangeId}`,
    data: {
      exchange_id: exchangeId,
      shift_id: typedExchange.shift_id,
      action_url: `/exchanges/${exchangeId}`,
    },
  });

  await recordExchangeEvent({
    exchangeId,
    actorId: user.id,
    eventType: "cancellation_rejected",
    title: "Retirada rechazada",
    details: "La solicitud continua activa y sigue pendiente de validacion.",
  });

  revalidateExchangeViews(exchangeId, typedExchange.shift_id);
}

/**
 * cancelExchange — cancel before the interested party signs (status = accepted).
 * Either party can cancel at this stage without mutual confirmation.
 */
export async function cancelExchange(formData: FormData): Promise<void> {
  const exchangeId = formData.get("exchange_id") as string;
  if (!exchangeId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { data: exchange } = await supabase
    .from("exchanges")
    .select("id, shift_id, user_a_id, user_b_id, status")
    .eq("id", exchangeId)
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .eq("status", "accepted")
    .single();

  if (!exchange) return;

  await supabase
    .from("exchanges")
    .update({ status: "cancelled" })
    .eq("id", exchangeId);

  await reopenShiftAfterExchangeReset(supabase, exchange.shift_id);

  await resolveExchangeInbox(exchangeId, [exchange.user_a_id, exchange.user_b_id]);

  const otherUserId =
    user.id === exchange.user_a_id ? exchange.user_b_id : exchange.user_a_id;

  await createNotification({
    userId: otherUserId,
    type: "exchange_cancelled",
    title: "Intercambio cancelado",
    body: "La otra parte ha cancelado este expediente y el turno vuelve a quedar disponible.",
    dedupeKey: `exchange_cancelled:${exchangeId}`,
    data: {
      exchange_id: exchangeId,
      shift_id: exchange.shift_id,
      action_url: `/exchanges/${exchangeId}`,
    },
  });

  await recordExchangeEvent({
    exchangeId,
    actorId: user.id,
    eventType: "exchange_cancelled",
    title: "Expediente cancelado",
    details: "La solicitud se ha cancelado antes de enviarse a validacion.",
    fromStatus: exchange.status,
    toStatus: "cancelled",
  });

  revalidateExchangeViews(exchangeId, exchange.shift_id);
}
