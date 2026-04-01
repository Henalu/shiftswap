"use server";

import { revalidatePath } from "next/cache";
import { recordExchangeEvent } from "@/lib/exchange-workflow";
import { getAgreementSummary } from "@/lib/exchange-compensation";
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

export async function acceptProposal(formData: FormData): Promise<void> {
  const requestId = formData.get("request_id") as string;
  const shiftId = formData.get("shift_id") as string;

  if (!requestId || !shiftId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  // Validate shift ownership and open status
  const { data: shift } = await supabase
    .from("shifts")
    .select("user_id, status, department_id")
    .eq("id", shiftId)
    .single();

  if (!shift || shift.user_id !== user.id || shift.status !== "open") return;

  // Ensure no active exchange already exists
  const { data: activeExchange } = await supabase
    .from("exchanges")
    .select("id")
    .eq("shift_id", shiftId)
    .in("status", [
      "accepted",
      "pending_validation",
      "approved",
      "completed",
    ])
    .limit(1)
    .maybeSingle();

  if (activeExchange) return;

  // Load the proposal with agreement details
  const { data: request } = await supabase
    .from("shift_requests")
    .select("id, interested_user_id, agreement_type, compensation_shift_date, compensation_shift_type")
    .eq("id", requestId)
    .eq("status", "pending")
    .single();

  if (!request || !request.agreement_type) return;

  // Verify proposer is in the same department
  const { data: requesterProfile } = await supabase
    .from("user_profiles")
    .select("department_id")
    .eq("id", request.interested_user_id)
    .maybeSingle();

  if (!requesterProfile || requesterProfile.department_id !== shift.department_id) {
    return;
  }

  const now = new Date().toISOString();
  const [ownerName, requesterName] = await Promise.all([
    getUserFullName(supabase, user.id),
    getUserFullName(supabase, request.interested_user_id),
  ]);

  // 1. Accept this proposal
  await supabase
    .from("shift_requests")
    .update({ status: "accepted" })
    .eq("id", requestId);

  // 2. Reject all other pending proposals
  await supabase
    .from("shift_requests")
    .update({ status: "rejected" })
    .eq("shift_id", shiftId)
    .eq("status", "pending")
    .neq("id", requestId);

  // 3. Lock the shift
  await supabase
    .from("shifts")
    .update({ status: "negotiating" })
    .eq("id", shiftId);

  // 4. Create exchange with status=accepted (publisher's acceptance = implicit signature)
  const { data: createdExchange } = await supabase
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

  const exchangeId = createdExchange?.id ?? null;

  if (exchangeId) {
    await recordExchangeEvent({
      exchangeId,
      actorId: user.id,
      eventType: "proposal_accepted",
      title: `${ownerName} ha aceptado la propuesta de ${requesterName}`,
      details: getAgreementSummary({
        agreementType: request.agreement_type as "hours_bank" | "shift_exchange",
        compensationShiftType: request.compensation_shift_type as "morning" | "afternoon" | "night" | null,
        compensationShiftDate: request.compensation_shift_date,
        ownerName,
        requesterName,
      }),
      toStatus: "accepted",
    });
  }

  // 5. Notify the interested party
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

  // 6. Notify rejected proposers
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

  // 7. Resolve owner's proposal notifications
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
