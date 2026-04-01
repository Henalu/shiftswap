"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createNotification, resolveNotifications } from "@/lib/notifications";
import { isExchangeAgreementType } from "@/lib/exchange-compensation";
import { isShiftType } from "@/lib/shifts";
import { requireSignature } from "@/lib/user-profiles";
import { formatShortDate } from "@/lib/utils";

export interface ProposalState {
  error?: string;
  success?: boolean;
}

export async function proposeExchange(
  _prevState: ProposalState | null,
  formData: FormData
): Promise<ProposalState> {
  const shiftId = formData.get("shift_id") as string;
  const agreementTypeValue = (formData.get("agreement_type") as string)?.trim();

  if (!shiftId) return { error: "Turno no especificado." };

  if (!isExchangeAgreementType(agreementTypeValue)) {
    return { error: "Tipo de acuerdo no valido." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Debes iniciar sesion." };

  const signatureCheck = await requireSignature(user.id);
  if (signatureCheck.error) return { error: signatureCheck.error };

  const [{ data: profile }, { data: shift }] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("department_id")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("shifts")
      .select("id, user_id, department_id, status, accepted_modalities")
      .eq("id", shiftId)
      .maybeSingle(),
  ]);

  if (!profile?.department_id) {
    return {
      error: "Tu perfil no tiene un departamento operativo valido.",
    };
  }

  if (!shift || shift.user_id === user.id || shift.status !== "open") {
    return { error: "Este turno ya no esta disponible." };
  }

  if (shift.department_id !== profile.department_id) {
    return { error: "Solo puedes proponer en turnos de tu propio departamento." };
  }

  const modalities = (shift.accepted_modalities ?? []) as string[];
  if (!modalities.includes(agreementTypeValue)) {
    return { error: "El publicador no acepta este tipo de acuerdo." };
  }

  // Check if user already has an active proposal
  const { data: existingProposal } = await supabase
    .from("shift_requests")
    .select("id")
    .eq("shift_id", shiftId)
    .eq("interested_user_id", user.id)
    .in("status", ["pending", "accepted"])
    .maybeSingle();

  if (existingProposal) {
    return { error: "Ya tienes una propuesta activa en este turno." };
  }

  let compensationShiftDate: string | null = null;
  let compensationShiftType: string | null = null;

  if (agreementTypeValue === "shift_exchange") {
    compensationShiftDate =
      (formData.get("compensation_shift_date") as string)?.trim() || null;
    const compensationShiftTypeValue =
      (formData.get("compensation_shift_type") as string)?.trim() || null;

    if (!compensationShiftDate) {
      return { error: "Indica la fecha del turno que ofreces a cambio." };
    }

    const today = new Date().toISOString().slice(0, 10);
    if (compensationShiftDate <= today) {
      return { error: "La fecha del turno ofrecido debe ser futura." };
    }

    if (!isShiftType(compensationShiftTypeValue)) {
      return { error: "Selecciona el tipo de turno que ofreces." };
    }

    compensationShiftType = compensationShiftTypeValue;
  }

  // Reactivate a withdrawn proposal if exists
  const { data: withdrawn } = await supabase
    .from("shift_requests")
    .select("id")
    .eq("shift_id", shiftId)
    .eq("interested_user_id", user.id)
    .eq("status", "withdrawn")
    .maybeSingle();

  let requestId: string;

  if (withdrawn) {
    const { error: updateError } = await supabase
      .from("shift_requests")
      .update({
        status: "pending",
        agreement_type: agreementTypeValue,
        compensation_shift_date: compensationShiftDate,
        compensation_shift_type: compensationShiftType,
      })
      .eq("id", withdrawn.id);

    if (updateError) return { error: updateError.message };
    requestId = withdrawn.id;
  } else {
    const { data: newRequest, error } = await supabase
      .from("shift_requests")
      .insert({
        shift_id: shiftId,
        interested_user_id: user.id,
        status: "pending",
        agreement_type: agreementTypeValue,
        compensation_shift_date: compensationShiftDate,
        compensation_shift_type: compensationShiftType,
      })
      .select("id")
      .single();

    if (error) return { error: error.message };
    requestId = newRequest.id;
  }

  // Notify shift owner
  const [{ data: shiftData }, { data: proposerProfile }] = await Promise.all([
    supabase
      .from("shifts")
      .select("user_id, date")
      .eq("id", shiftId)
      .single(),
    supabase
      .from("user_profiles")
      .select("full_name")
      .eq("id", user.id)
      .single(),
  ]);

  if (shiftData && proposerProfile) {
    await createNotification({
      userId: shiftData.user_id,
      type: "proposal_received",
      title: "Nueva propuesta en tu turno",
      body: `${proposerProfile.full_name} quiere tu turno del ${formatShortDate(shiftData.date)}.`,
      dedupeKey: `proposal_received:${requestId}`,
      data: {
        shift_id: shiftId,
        request_id: requestId,
        interested_user_id: user.id,
        action_url: `/shifts/my`,
      },
    });
  }

  revalidatePath("/shifts");
  revalidatePath(`/shifts/${shiftId}`);
  revalidatePath("/shifts/my");

  return { success: true };
}

export async function withdrawProposal(
  formData: FormData
): Promise<void> {
  const requestId = formData.get("request_id") as string;
  const shiftId = formData.get("shift_id") as string;

  if (!requestId || !shiftId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { error } = await supabase
    .from("shift_requests")
    .update({ status: "withdrawn" })
    .eq("id", requestId)
    .eq("interested_user_id", user.id)
    .eq("status", "pending");

  if (error) return;

  const { data: shift } = await supabase
    .from("shifts")
    .select("user_id")
    .eq("id", shiftId)
    .single();

  if (shift) {
    await resolveNotifications({
      userId: shift.user_id,
      dedupeKey: `proposal_received:${requestId}`,
      unresolvedOnly: true,
    });
  }

  revalidatePath("/shifts");
  revalidatePath(`/shifts/${shiftId}`);
  revalidatePath("/shifts/my");
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
      .eq("status", "open")
      .maybeSingle(),
    supabase
      .from("shift_requests")
      .select("id, interested_user_id, status")
      .eq("shift_id", shiftId)
      .eq("status", "pending"),
  ]);

  if (!shift) return;

  await supabase
    .from("shifts")
    .update({ status: "cancelled" })
    .eq("id", shiftId)
    .eq("user_id", user.id)
    .eq("status", "open");

  await resolveNotifications({
    userId: user.id,
    types: ["proposal_received"],
    dataContains: { shift_id: shiftId },
    unresolvedOnly: true,
  });

  for (const request of requests ?? []) {
    await createNotification({
      userId: request.interested_user_id,
      type: "shift_cancelled",
      title: "Turno cancelado",
      body: "El turno en el que habias propuesto ya no esta disponible.",
      dedupeKey: `shift_cancelled:${shiftId}`,
      data: {
        shift_id: shiftId,
        action_url: `/shifts/${shiftId}`,
      },
    });
  }

  revalidatePath("/shifts");
  revalidatePath("/shifts/my");
  revalidatePath(`/shifts/${shiftId}`);
}
