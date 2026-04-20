"use server";

import { revalidatePath } from "next/cache";
import { withdrawPendingCompensationProposalConflicts } from "@/lib/compensation-proposals";
import {
  findActiveExchangeSlotLock,
  isActiveExchangeSlotLockError,
} from "@/lib/exchange-slot-locks";
import { recordExchangeEvent } from "@/lib/exchange-workflow";
import { getAgreementSummary } from "@/lib/exchange-compensation";
import { requireSignature } from "@/lib/user-profiles";
import { createClient } from "@/lib/supabase/server";
import { createNotification, resolveNotifications } from "@/lib/notifications";
import type { ShiftType } from "@/types";

function revalidateShiftViews(shiftId: string) {
  revalidatePath("/shifts");
  revalidatePath("/shifts/my");
  revalidatePath(`/shifts/${shiftId}`);
  revalidatePath("/exchanges");
  revalidatePath("/calendar");
  revalidatePath("/shifts/new");
}

async function getUserFullName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("user_profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  return data?.full_name ?? "Empleado";
}

export async function acceptProposal(formData: FormData): Promise<void> {
  const requestId = formData.get("request_id") as string;
  const shiftId = formData.get("shift_id") as string;

  if (!requestId || !shiftId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const signatureCheck = await requireSignature(user.id);
  if (signatureCheck.error) return;

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
    .in("status", ["accepted", "pending_validation", "approved", "completed"])
    .limit(1)
    .maybeSingle();

  if (activeExchange) return;

  const { data: request } = await supabase
    .from("shift_requests")
    .select(
      "id, interested_user_id, agreement_type, compensation_shift_date, compensation_shift_type",
    )
    .eq("id", requestId)
    .eq("status", "pending")
    .single();

  if (!request || !request.agreement_type) return;

  const isInvalidRestProposal =
    request.agreement_type === "shift_exchange" &&
    (!request.compensation_shift_type ||
      request.compensation_shift_type === "rest");

  if (isInvalidRestProposal) {
    await supabase
      .from("shift_requests")
      .update({ status: "rejected" })
      .eq("id", requestId)
      .eq("status", "pending");

    await createNotification({
      userId: request.interested_user_id,
      type: "proposal_rejected",
      title: "Propuesta no valida",
      body: "No se pueden intercambiar descansos. Propone un turno real de trabajo.",
      dedupeKey: `proposal_rejected:${requestId}`,
      data: {
        shift_id: shiftId,
        action_url: `/shifts/${shiftId}`,
      },
    });

    await resolveNotifications({
      userId: user.id,
      dedupeKey: `proposal_received:${requestId}`,
      unresolvedOnly: true,
    });

    revalidateShiftViews(shiftId);
    return;
  }

  const { data: requesterProfile } = await supabase
    .from("user_profiles")
    .select("department_id")
    .eq("id", request.interested_user_id)
    .maybeSingle();

  if (
    !requesterProfile ||
    requesterProfile.department_id !== shift.department_id
  ) {
    return;
  }

  if (
    request.agreement_type === "shift_exchange" &&
    request.compensation_shift_date &&
    request.compensation_shift_type &&
    request.compensation_shift_type !== "rest"
  ) {
    const activeExchangeLock = await findActiveExchangeSlotLock({
      userId: request.interested_user_id,
      date: request.compensation_shift_date,
      shiftType: request.compensation_shift_type,
    });

    if (activeExchangeLock) {
      await supabase
        .from("shift_requests")
        .update({ status: "rejected" })
        .eq("id", requestId)
        .eq("status", "pending");

      await createNotification({
        userId: request.interested_user_id,
        type: "proposal_rejected",
        title: "Propuesta ya no disponible",
        body: "Ese turno ofrecido ya esta comprometido en otro intercambio activo.",
        dedupeKey: `proposal_rejected:${requestId}`,
        data: {
          shift_id: shiftId,
          action_url: `/shifts/${shiftId}`,
        },
      });

      await resolveNotifications({
        userId: user.id,
        dedupeKey: `proposal_received:${requestId}`,
        unresolvedOnly: true,
      });

      revalidateShiftViews(shiftId);
      return;
    }
  }

  const now = new Date().toISOString();
  const [ownerName, requesterName] = await Promise.all([
    getUserFullName(supabase, user.id),
    getUserFullName(supabase, request.interested_user_id),
  ]);

  const { data: createdExchange, error: createExchangeError } = await supabase
    .from("exchanges")
    .insert({
      shift_id: shiftId,
      user_a_id: user.id,
      user_b_id: request.interested_user_id,
      status: "accepted",
      agreement_type: request.agreement_type,
      compensation_shift_date: request.compensation_shift_date ?? null,
      compensation_shift_type: request.compensation_shift_type ?? null,
      confirmed_at: now,
      signed_by_user_a_at: now,
      signed_by_user_a_name: ownerName,
    })
    .select("id")
    .single();

  if (createExchangeError) {
    if (isActiveExchangeSlotLockError(createExchangeError)) {
      await supabase
        .from("shift_requests")
        .update({ status: "rejected" })
        .eq("id", requestId)
        .eq("status", "pending");

      await createNotification({
        userId: request.interested_user_id,
        type: "proposal_rejected",
        title: "Propuesta ya no disponible",
        body:
          request.agreement_type === "shift_exchange"
            ? "El turno que ofrecias ya se ha comprometido en otro intercambio activo."
            : "Este expediente ya no esta disponible para aceptarse.",
        dedupeKey: `proposal_rejected:${requestId}`,
        data: {
          shift_id: shiftId,
          action_url: `/shifts/${shiftId}`,
        },
      });

      await resolveNotifications({
        userId: user.id,
        dedupeKey: `proposal_received:${requestId}`,
        unresolvedOnly: true,
      });
    }

    revalidateShiftViews(shiftId);
    return;
  }

  const exchangeId = createdExchange?.id ?? null;

  await supabase
    .from("shift_requests")
    .update({ status: "accepted" })
    .eq("id", requestId)
    .eq("status", "pending");

  await supabase
    .from("shift_requests")
    .update({ status: "rejected" })
    .eq("shift_id", shiftId)
    .eq("status", "pending")
    .neq("id", requestId);

  await supabase
    .from("shifts")
    .update({ status: "negotiating" })
    .eq("id", shiftId)
    .eq("status", "open");

  const withdrawnConflicts =
    request.agreement_type === "shift_exchange" &&
    request.compensation_shift_date &&
    request.compensation_shift_type &&
    request.compensation_shift_type !== "rest"
      ? await withdrawPendingCompensationProposalConflicts({
          interestedUserId: request.interested_user_id,
          compensationShiftDate: request.compensation_shift_date,
          compensationShiftType: request.compensation_shift_type,
          excludeRequestId: request.id,
        })
      : [];

  if (exchangeId) {
    await recordExchangeEvent({
      exchangeId,
      actorId: user.id,
      eventType: "proposal_accepted",
      title: `${ownerName} ha aceptado la propuesta de ${requesterName}`,
      details: getAgreementSummary({
        agreementType: request.agreement_type as
          | "hours_bank"
          | "shift_exchange",
        compensationShiftType: request.compensation_shift_type as
          | ShiftType
          | "rest"
          | null,
        compensationShiftDate: request.compensation_shift_date,
        ownerName,
        requesterName,
      }),
      toStatus: "accepted",
    });
  }

  const withdrawnShiftOwnerById = new Map<string, string>();

  if (withdrawnConflicts.length > 0) {
    const { data: withdrawnConflictShifts } = await supabase
      .from("shifts")
      .select("id, user_id")
      .in(
        "id",
        withdrawnConflicts.map((conflict) => conflict.shift_id),
      );

    for (const shiftRow of withdrawnConflictShifts ?? []) {
      withdrawnShiftOwnerById.set(shiftRow.id, shiftRow.user_id);
    }
  }

  for (const withdrawnConflict of withdrawnConflicts) {
    await resolveNotifications({
      dedupeKey: `proposal_received:${withdrawnConflict.id}`,
      unresolvedOnly: true,
    });

    const shiftOwnerId = withdrawnShiftOwnerById.get(withdrawnConflict.shift_id);
    if (shiftOwnerId) {
      await createNotification({
        userId: shiftOwnerId,
        type: "proposal_rejected",
        title: "Propuesta retirada automaticamente",
        body: `${requesterName} ya ha comprometido el turno que ofrecia en otro intercambio y esta propuesta deja de estar disponible.`,
        dedupeKey: `proposal_rejected_owner:${withdrawnConflict.id}`,
        data: {
          shift_id: withdrawnConflict.shift_id,
          request_id: withdrawnConflict.id,
          action_url: "/shifts/my",
        },
      });
    }

    revalidatePath(`/shifts/${withdrawnConflict.shift_id}`);
  }

  await createNotification({
    userId: request.interested_user_id,
    type: "proposal_accepted",
    title: "Tu propuesta fue aceptada",
    body: `${ownerName} ha aceptado tu propuesta. Firma para enviarla a validacion.`,
    dedupeKey: `proposal_accepted:${exchangeId ?? requestId}`,
    data: {
      shift_id: shiftId,
      request_id: requestId,
      exchange_id: exchangeId ?? undefined,
      action_url: exchangeId ? `/exchanges/${exchangeId}` : "/exchanges",
    },
  });

  const { data: rejectedRequests } = await supabase
    .from("shift_requests")
    .select("id, interested_user_id")
    .eq("shift_id", shiftId)
    .eq("status", "rejected");

  for (const rejected of rejectedRequests ?? []) {
    if (rejected.interested_user_id === request.interested_user_id) continue;
    await createNotification({
      userId: rejected.interested_user_id,
      type: "proposal_rejected",
      title: "Propuesta no seleccionada",
      body: "El publicador ha elegido otra propuesta para este turno.",
      dedupeKey: `proposal_rejected:${rejected.id}`,
      data: {
        shift_id: shiftId,
        action_url: `/shifts/${shiftId}`,
      },
    });
  }

  await resolveNotifications({
    userId: user.id,
    types: ["proposal_received"],
    dataContains: { shift_id: shiftId },
    unresolvedOnly: true,
  });

  revalidateShiftViews(shiftId);
}

export async function rejectProposal(formData: FormData): Promise<void> {
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
    .eq("status", "pending")
    .single();

  if (!request) return;

  await supabase
    .from("shift_requests")
    .update({ status: "rejected" })
    .eq("id", requestId);

  await createNotification({
    userId: request.interested_user_id,
    type: "proposal_rejected",
    title: "Propuesta rechazada",
    body: "El publicador no ha aceptado tu propuesta en este momento.",
    dedupeKey: `proposal_rejected:${requestId}`,
    data: {
      shift_id: shiftId,
      action_url: `/shifts/${shiftId}`,
    },
  });

  await resolveNotifications({
    userId: user.id,
    dedupeKey: `proposal_received:${requestId}`,
    unresolvedOnly: true,
  });

  revalidatePath("/shifts/my");
  revalidatePath(`/shifts/${shiftId}`);
}
