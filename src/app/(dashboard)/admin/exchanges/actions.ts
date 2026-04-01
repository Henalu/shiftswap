"use server";

import { revalidatePath } from "next/cache";
import { syncHoursBankDebtTransactionStatus } from "@/lib/exchange-compensation";
import {
  canReviewExchange,
  getAuthenticatedExchangeActor,
  recordExchangeEvent,
} from "@/lib/exchange-workflow";
import { createNotification, resolveNotifications } from "@/lib/notifications";
import { pickFirstRelation } from "@/lib/supabase-relations";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ExchangeAgreementType, ExchangeStatus } from "@/types";

export interface ExchangeApprovalMutationResult {
  success?: true;
  error?: string;
}

interface ApprovalTarget {
  id: string;
  shift_id: string;
  status: ExchangeStatus;
  agreement_type: ExchangeAgreementType | null;
  user_a_id: string;
  user_b_id: string;
  owner: { id: string; full_name: string };
  requester: { id: string; full_name: string };
  shift: {
    id: string;
    department_id: string;
    department: {
      id: string;
      name: string;
      company_id: string;
    };
  };
}

function revalidateExchangeApprovalViews(exchangeId: string, shiftId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/exchanges");
  revalidatePath("/exchanges");
  revalidatePath(`/exchanges/${exchangeId}`);
  revalidatePath("/shifts");
  revalidatePath("/shifts/my");
  revalidatePath(`/shifts/${shiftId}`);
}

async function getApprovalTarget(exchangeId: string): Promise<ApprovalTarget | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("exchanges")
    .select(
      `
      id, shift_id, status, agreement_type, user_a_id, user_b_id,
      owner:user_profiles!user_a_id(id, full_name),
      requester:user_profiles!user_b_id(id, full_name),
      shift:shifts!shift_id(
        id,
        department_id,
        department:departments!department_id(id, name, company_id)
      )
    `
    )
    .eq("id", exchangeId)
    .maybeSingle();

  if (error) {
    console.error("[admin/exchanges] Failed to load approval target", {
      exchangeId,
      message: error.message,
    });
    return null;
  }

  if (!data) {
    return null;
  }

  const typed = data as unknown as ApprovalTarget & {
    owner: ApprovalTarget["owner"] | ApprovalTarget["owner"][];
    requester: ApprovalTarget["requester"] | ApprovalTarget["requester"][];
    shift:
      | (ApprovalTarget["shift"] & {
          department:
            | ApprovalTarget["shift"]["department"]
            | ApprovalTarget["shift"]["department"][];
        })
      | ApprovalTarget["shift"][];
  };
  const shift = pickFirstRelation(typed.shift);

  if (!shift) {
    return null;
  }

  return {
    ...typed,
    owner: pickFirstRelation(typed.owner) ?? null,
    requester: pickFirstRelation(typed.requester) ?? null,
    shift: {
      ...shift,
      department: pickFirstRelation(shift.department) ?? shift.department,
    },
  } as ApprovalTarget;
}

async function getAuthenticatedApprovalActor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return getAuthenticatedExchangeActor(user.id);
}

async function reopenRejectedShift(
  shiftId: string,
  requesterId: string
): Promise<void> {
  const supabase = createAdminClient();

  await supabase.from("shifts").update({ status: "open" }).eq("id", shiftId);

  await supabase
    .from("shift_requests")
    .update({ status: "pending" })
    .eq("shift_id", shiftId)
    .eq("interested_user_id", requesterId)
    .eq("status", "accepted");
}

export async function approveExchangeRequest(
  formData: FormData
): Promise<ExchangeApprovalMutationResult> {
  const exchangeId = (formData.get("exchange_id") as string | null)?.trim();
  const approvalNotes = (formData.get("approval_notes") as string | null)?.trim();

  if (!exchangeId) {
    return { error: "La solicitud es invalida." };
  }

  const actor = await getAuthenticatedApprovalActor();
  if (!actor) {
    return { error: "No tienes permisos para aprobar este cambio." };
  }

  const target = await getApprovalTarget(exchangeId);
  if (!target || target.status !== "pending_validation") {
    return { error: "La solicitud ya no esta pendiente de aprobacion." };
  }

  if (target.user_a_id === actor.id || target.user_b_id === actor.id) {
    return {
      error: "La aprobacion debe resolverla una tercera persona del departamento.",
    };
  }

  if (
    !canReviewExchange(actor, {
      user_a_id: target.user_a_id,
      user_b_id: target.user_b_id,
      company_id: target.shift.department.company_id,
      department_id: target.shift.department_id,
    })
  ) {
    return { error: "Tu rol no tiene alcance sobre este intercambio." };
  }

  const now = new Date().toISOString();
  const supabase = createAdminClient();
  const { error: updateError } = await supabase
    .from("exchanges")
    .update({
      status: "approved",
      department_approver_id: actor.id,
      department_reviewed_at: now,
      department_decision_notes: approvalNotes || null,
      approved_at: now,
      rejected_at: null,
      cancellation_requested_by: null,
      cancellation_requested_at: null,
    })
    .eq("id", exchangeId)
    .eq("status", "pending_validation");

  if (updateError) {
    return { error: "No se pudo aprobar la solicitud. " + updateError.message };
  }

  if (target.agreement_type === "hours_bank") {
    await syncHoursBankDebtTransactionStatus(exchangeId, "active");
  }

  await resolveNotifications({
    dedupeKey: `exchange_pending_validation:${exchangeId}`,
    unresolvedOnly: true,
  });

  for (const participantId of [target.user_a_id, target.user_b_id]) {
    await createNotification({
      userId: participantId,
      type: "exchange_department_approved",
      title: "Cambio aprobado",
      body: "El responsable del departamento ha aprobado el intercambio.",
      dedupeKey: `exchange_department_approved:${exchangeId}`,
      data: {
        exchange_id: exchangeId,
        shift_id: target.shift_id,
        action_url: `/exchanges/${exchangeId}`,
      },
    });
  }

  await recordExchangeEvent({
    exchangeId,
    actorId: actor.id,
    eventType: "department_approved",
    title: "Solicitud aprobada por el departamento",
    details: approvalNotes || "El cambio queda resuelto favorablemente dentro de la app.",
    fromStatus: "pending_validation",
    toStatus: "approved",
  });

  revalidateExchangeApprovalViews(exchangeId, target.shift_id);
  return { success: true };
}

export async function rejectExchangeRequest(
  formData: FormData
): Promise<ExchangeApprovalMutationResult> {
  const exchangeId = (formData.get("exchange_id") as string | null)?.trim();
  const rejectionNotes = (formData.get("rejection_notes") as string | null)?.trim();

  if (!exchangeId) {
    return { error: "La solicitud es invalida." };
  }

  if (!rejectionNotes) {
    return { error: "Debes explicar por que se rechaza el cambio." };
  }

  const actor = await getAuthenticatedApprovalActor();
  if (!actor) {
    return { error: "No tienes permisos para rechazar este cambio." };
  }

  const target = await getApprovalTarget(exchangeId);
  if (!target || target.status !== "pending_validation") {
    return { error: "La solicitud ya no esta pendiente de aprobacion." };
  }

  if (target.user_a_id === actor.id || target.user_b_id === actor.id) {
    return {
      error: "La decision debe resolverla una tercera persona del departamento.",
    };
  }

  if (
    !canReviewExchange(actor, {
      user_a_id: target.user_a_id,
      user_b_id: target.user_b_id,
      company_id: target.shift.department.company_id,
      department_id: target.shift.department_id,
    })
  ) {
    return { error: "Tu rol no tiene alcance sobre este intercambio." };
  }

  const now = new Date().toISOString();
  const supabase = createAdminClient();
  const { error: updateError } = await supabase
    .from("exchanges")
    .update({
      status: "rejected",
      department_approver_id: actor.id,
      department_reviewed_at: now,
      department_decision_notes: rejectionNotes,
      rejected_at: now,
      approved_at: null,
      cancellation_requested_by: null,
      cancellation_requested_at: null,
    })
    .eq("id", exchangeId)
    .eq("status", "pending_validation");

  if (updateError) {
    return { error: "No se pudo rechazar la solicitud. " + updateError.message };
  }

  if (target.agreement_type === "hours_bank") {
    await syncHoursBankDebtTransactionStatus(exchangeId, "voided");
  }

  await reopenRejectedShift(target.shift_id, target.user_b_id);

  await resolveNotifications({
    dedupeKey: `exchange_pending_validation:${exchangeId}`,
    unresolvedOnly: true,
  });

  for (const participantId of [target.user_a_id, target.user_b_id]) {
    await createNotification({
      userId: participantId,
      type: "exchange_department_rejected",
      title: "Cambio rechazado",
      body: "El departamento ha rechazado la solicitud. Revisa las observaciones para entender el motivo.",
      dedupeKey: `exchange_department_rejected:${exchangeId}`,
      data: {
        exchange_id: exchangeId,
        shift_id: target.shift_id,
        action_url: `/exchanges/${exchangeId}`,
        rejection_notes: rejectionNotes,
      },
    });
  }

  await recordExchangeEvent({
    exchangeId,
    actorId: actor.id,
    eventType: "department_rejected",
    title: "Solicitud rechazada por el departamento",
    details: rejectionNotes,
    fromStatus: "pending_validation",
    toStatus: "rejected",
  });

  revalidateExchangeApprovalViews(exchangeId, target.shift_id);
  return { success: true };
}
