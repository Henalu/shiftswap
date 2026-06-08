"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  isValidCompensationDay,
  isValidWorkDay,
} from "@/lib/calendar";
import { getUserCalendarInput } from "@/lib/calendar-data";
import { findActiveExchangeDateConflict } from "@/lib/exchange-date-conflicts";
import {
  findActiveExchangeSlotLock,
  isActiveExchangeSlotLockError,
} from "@/lib/exchange-slot-locks";
import { recordExchangeEvent } from "@/lib/exchange-workflow";
import {
  getAgreementSummary,
  getMadridDateInputValue,
  getMinimumCompensationDate,
  isCompensationDateValid,
  isExchangeAgreementType,
} from "@/lib/exchange-compensation";
import { createNotification, resolveNotifications } from "@/lib/notifications";
import {
  getShiftSchedule,
  isCompensationShiftType,
  isShiftType,
  validateShiftCoverageWindow,
} from "@/lib/shifts";
import {
  expireStaleOpenShifts,
  isPastShiftPublicationDate,
} from "@/lib/stale-shifts";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireSignature } from "@/lib/user-profiles";
import { formatShortDate } from "@/lib/utils";
import type { ExchangeAgreementType, ShiftType } from "@/types";

export interface DirectProposalState {
  error?: string;
  success?: boolean;
}

interface ProfileScope {
  id: string;
  full_name: string | null;
  email: string | null;
  company_id: string;
  department_id: string | null;
  validation_status?: string | null;
}

function revalidateChatViews(conversationId?: string | null, shiftId?: string | null) {
  revalidatePath("/chat");
  revalidatePath("/shifts");
  revalidatePath("/shifts/my");
  revalidatePath("/exchanges");
  revalidatePath("/calendar");

  if (conversationId) {
    revalidatePath(`/chat/${conversationId}`);
  }

  if (shiftId) {
    revalidatePath(`/shifts/${shiftId}`);
  }
}

async function getProfileScope(
  userId: string,
): Promise<ProfileScope | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_profiles")
    .select("id, full_name, email, company_id, department_id, validation_status")
    .eq("id", userId)
    .maybeSingle();

  return (data as ProfileScope | null) ?? null;
}

async function ensureDirectConversationAccess(
  conversationId: string,
  currentUserId: string,
  otherUserId: string,
) {
  const admin = createAdminClient();
  const { data: conversation } = await admin
    .from("conversations")
    .select("id, participant_a_id, participant_b_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation) {
    return false;
  }

  const participants = [
    conversation.participant_a_id,
    conversation.participant_b_id,
  ];

  return participants.includes(currentUserId) && participants.includes(otherUserId);
}

async function getUserFullName(userId: string): Promise<string> {
  const profile = await getProfileScope(userId);
  return profile?.full_name?.trim() || profile?.email?.trim() || "Empleado";
}

export async function startConversation(formData: FormData): Promise<void> {
  const shiftId = ((formData.get("shift_id") as string | null) ?? "").trim();
  const otherUserId = ((formData.get("other_user_id") as string | null) ?? "").trim();

  if (!otherUserId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (otherUserId === user.id) return;

  const shiftFilter = shiftId || null;

  let existing1Query = supabase
    .from("conversations")
    .select("id")
    .match({
      participant_a_id: user.id,
      participant_b_id: otherUserId,
    });

  existing1Query = shiftFilter
    ? existing1Query.eq("shift_id", shiftFilter)
    : existing1Query.is("shift_id", null);

  const { data: existing1 } = await existing1Query.maybeSingle();

  if (existing1) redirect(`/chat/${existing1.id}`);

  let existing2Query = supabase
    .from("conversations")
    .select("id")
    .match({
      participant_a_id: otherUserId,
      participant_b_id: user.id,
    });

  existing2Query = shiftFilter
    ? existing2Query.eq("shift_id", shiftFilter)
    : existing2Query.is("shift_id", null);

  const { data: existing2 } = await existing2Query.maybeSingle();

  if (existing2) redirect(`/chat/${existing2.id}`);

  if (shiftId) {
    const { data: shift } = await supabase
      .from("shifts")
      .select("id, user_id, status, direct_recipient_id")
      .eq("id", shiftId)
      .maybeSingle();

    if (!shift) return;

    const isShiftOwner = shift.user_id === user.id;
    const requesterId = isShiftOwner ? otherUserId : user.id;

    if (!isShiftOwner && shift.user_id !== otherUserId) {
      return;
    }

    const { data: activeRequest } = await supabase
      .from("shift_requests")
      .select("id")
      .eq("shift_id", shiftId)
      .eq("interested_user_id", requesterId)
      .in("status", ["pending", "accepted"])
      .maybeSingle();

    const canOpenPreProposalShiftChat =
      !isShiftOwner &&
      shift.status === "open" &&
      shift.direct_recipient_id === null;

    if (!activeRequest && !canOpenPreProposalShiftChat) {
      return;
    }
  } else {
    const [currentProfile, otherProfile] = await Promise.all([
      getProfileScope(user.id),
      getProfileScope(otherUserId),
    ]);

    if (
      !currentProfile ||
      !otherProfile ||
      currentProfile.company_id !== otherProfile.company_id ||
      otherProfile.validation_status !== "approved"
    ) {
      return;
    }
  }

  const { data: newConv } = await supabase
    .from("conversations")
    .insert({
      shift_id: shiftFilter,
      participant_a_id: user.id,
      participant_b_id: otherUserId,
    })
    .select("id")
    .single();

  if (newConv) redirect(`/chat/${newConv.id}`);
}

export async function sendDirectProposal(
  _prevState: DirectProposalState | null,
  formData: FormData,
): Promise<DirectProposalState> {
  const conversationId = ((formData.get("conversation_id") as string | null) ?? "").trim();
  const recipientId = ((formData.get("recipient_user_id") as string | null) ?? "").trim();
  const date = ((formData.get("date") as string | null) ?? "").trim();
  const shiftTypeValue = ((formData.get("shift_type") as string | null) ?? "").trim();
  const agreementTypeValue = ((formData.get("agreement_type") as string | null) ?? "").trim();
  const submittedCoverageStartTime =
    ((formData.get("coverage_start_time") as string | null) ?? "").trim() ||
    null;
  const submittedCoverageEndTime =
    ((formData.get("coverage_end_time") as string | null) ?? "").trim() ||
    null;
  const description =
    ((formData.get("description") as string | null) ?? "").trim() || null;

  if (!conversationId || !recipientId) {
    return { error: "Conversacion o destinatario no especificado." };
  }

  if (!date || !isShiftType(shiftTypeValue)) {
    return { error: "Indica la fecha y el turno que quieres proponer." };
  }

  if (!isExchangeAgreementType(agreementTypeValue)) {
    return { error: "Selecciona una modalidad valida." };
  }

  if (date < getMadridDateInputValue()) {
    return { error: "No puedes enviar una propuesta para una fecha pasada." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Debes iniciar sesion." };
  if (recipientId === user.id) return { error: "No puedes proponerte a ti mismo." };

  const signatureCheck = await requireSignature(user.id);
  if (signatureCheck.error) return { error: signatureCheck.error };

  const [senderProfile, recipientProfile] = await Promise.all([
    getProfileScope(user.id),
    getProfileScope(recipientId),
  ]);

  if (!senderProfile?.department_id) {
    return {
      error: "Tu perfil no tiene un departamento operativo valido.",
    };
  }

  if (
    !recipientProfile ||
    recipientProfile.validation_status !== "approved" ||
    recipientProfile.company_id !== senderProfile.company_id
  ) {
    return { error: "No puedes enviar propuestas a ese usuario." };
  }

  if (recipientProfile.department_id !== senderProfile.department_id) {
    return {
      error:
        "Solo puedes enviar propuestas directas a usuarios de tu mismo departamento operativo.",
    };
  }

  const senderName = senderProfile.full_name ?? senderProfile.email ?? "Empleado";

  const hasConversationAccess = await ensureDirectConversationAccess(
    conversationId,
    user.id,
    recipientId,
  );

  if (!hasConversationAccess) {
    return { error: "No puedes enviar propuestas desde esta conversacion." };
  }

  const calendarConfig = await getUserCalendarInput({
    userId: user.id,
    startDate: date,
    endDate: date,
  });

  const workDayCheck = isValidWorkDay(date, shiftTypeValue, calendarConfig);
  if (!workDayCheck.valid) {
    return { error: workDayCheck.reason };
  }

  const ownerSlotLock = await findActiveExchangeSlotLock({
    userId: user.id,
    date,
    shiftType: shiftTypeValue,
  });

  if (ownerSlotLock) {
    return {
      error:
        "Ese turno ya esta comprometido en un intercambio activo y no puedes proponerlo.",
    };
  }

  const [ownerDateConflict, recipientDateConflict] = await Promise.all([
    findActiveExchangeDateConflict({ userId: user.id, dates: [date] }),
    findActiveExchangeDateConflict({ userId: recipientId, dates: [date] }),
  ]);

  if (ownerDateConflict || recipientDateConflict) {
    return {
      error: ownerDateConflict
        ? "Ya tienes un cambio activo en esa fecha."
        : "La persona destinataria ya tiene un cambio activo en esa fecha.",
    };
  }

  let compensationShiftDate: string | null = null;
  let compensationShiftType: ShiftType | null = null;

  if (agreementTypeValue === "shift_exchange") {
    compensationShiftDate =
      ((formData.get("compensation_shift_date") as string | null) ?? "").trim() ||
      null;
    const compensationShiftTypeValue =
      ((formData.get("compensation_shift_type") as string | null) ?? "").trim() ||
      null;

    if (!compensationShiftDate) {
      return { error: "Indica la fecha del turno que quieres recibir a cambio." };
    }

    if (
      !isCompensationDateValid(
        compensationShiftDate,
        getMinimumCompensationDate(),
      )
    ) {
      return { error: "La compensacion debe ser futura." };
    }

    if (!isCompensationShiftType(compensationShiftTypeValue)) {
      return { error: "Selecciona un turno valido para la compensacion." };
    }

    compensationShiftType = compensationShiftTypeValue;

    const recipientCalendarConfig = await getUserCalendarInput({
      userId: recipientId,
      startDate: compensationShiftDate,
      endDate: compensationShiftDate,
    });

    const compensationDayCheck = isValidCompensationDay(
      compensationShiftDate,
      compensationShiftType,
      recipientCalendarConfig,
    );

    if (!compensationDayCheck.valid) {
      return {
        error: `El turno que pides a cambio: ${compensationDayCheck.reason}`,
      };
    }

    const compensationSlotLock = await findActiveExchangeSlotLock({
      userId: recipientId,
      date: compensationShiftDate,
      shiftType: compensationShiftType,
    });

    if (compensationSlotLock) {
      return {
        error:
          "Ese turno de compensacion ya esta comprometido en otro intercambio.",
      };
    }

    const compensationDateConflict = await findActiveExchangeDateConflict({
      userId: recipientId,
      dates: [compensationShiftDate],
    });

    if (compensationDateConflict) {
      return {
        error:
          "La persona destinataria ya tiene un cambio activo en la fecha de compensacion.",
      };
    }
  }

  const { data: existingDirectShift } = await supabase
    .from("shifts")
    .select("id")
    .eq("user_id", user.id)
    .eq("direct_recipient_id", recipientId)
    .eq("date", date)
    .in("status", ["open", "negotiating"])
    .maybeSingle();

  if (existingDirectShift) {
    return {
      error:
        "Ya hay una propuesta activa con esa persona para esa fecha.",
    };
  }

  const schedule = getShiftSchedule(shiftTypeValue);
  const validModalities: ExchangeAgreementType[] = [agreementTypeValue];
  const hasCoverageWindow = Boolean(
    submittedCoverageStartTime || submittedCoverageEndTime,
  );
  let coverageStartTime: string | null = null;
  let coverageEndTime: string | null = null;

  if (hasCoverageWindow) {
    if (agreementTypeValue !== "hours_bank") {
      return {
        error:
          "La cobertura parcial solo es compatible con bolsa de horas.",
      };
    }

    const coverageCheck = validateShiftCoverageWindow({
      shiftStartTime: schedule.startTime,
      shiftEndTime: schedule.endTime,
      coverageStartTime: submittedCoverageStartTime,
      coverageEndTime: submittedCoverageEndTime,
    });

    if (!coverageCheck.valid) {
      return { error: coverageCheck.reason };
    }

    coverageStartTime = coverageCheck.startTime;
    coverageEndTime = coverageCheck.endTime;
  }

  const { data: shift, error: shiftError } = await supabase
    .from("shifts")
    .insert({
      user_id: user.id,
      direct_recipient_id: recipientId,
      department_id: senderProfile.department_id,
      date,
      start_time: schedule.startTime,
      end_time: schedule.endTime,
      coverage_start_time: coverageStartTime,
      coverage_end_time: coverageEndTime,
      shift_type: shiftTypeValue,
      description: description ?? undefined,
      accepted_modalities: validModalities,
      status: "open",
    })
    .select("id")
    .single();

  if (shiftError || !shift) {
    return { error: shiftError?.message ?? "No se pudo crear la propuesta." };
  }

  const { data: request, error: requestError } = await supabase
    .from("shift_requests")
    .insert({
      shift_id: shift.id,
      interested_user_id: recipientId,
      status: "pending",
      agreement_type: agreementTypeValue,
      compensation_shift_date: compensationShiftDate,
      compensation_shift_type: compensationShiftType,
    })
    .select("id")
    .single();

  if (requestError || !request) {
    await supabase
      .from("shifts")
      .update({ status: "cancelled" })
      .eq("id", shift.id)
      .eq("user_id", user.id);

    return { error: requestError?.message ?? "No se pudo enviar la propuesta." };
  }

  await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    content: `Te he enviado una propuesta directa para el ${formatShortDate(
      date,
    )}.`,
    read: false,
  });

  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  await createNotification({
    userId: recipientId,
    type: "proposal_received",
    title: "Propuesta directa recibida",
    body: `${senderName} te ha enviado una propuesta directa para el ${formatShortDate(date)}.`,
    dedupeKey: `proposal_received:${request.id}`,
    data: {
      shift_id: shift.id,
      request_id: request.id,
      conversation_id: conversationId,
      direct: true,
      action_url: `/chat/${conversationId}`,
    },
  });

  revalidateChatViews(conversationId, shift.id);

  return { success: true };
}

export async function acceptDirectProposal(formData: FormData): Promise<void> {
  const requestId = ((formData.get("request_id") as string | null) ?? "").trim();
  const shiftId = ((formData.get("shift_id") as string | null) ?? "").trim();
  const conversationId =
    ((formData.get("conversation_id") as string | null) ?? "").trim() || null;

  if (!requestId || !shiftId) return;

  const supabase = await createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { data: shift } = await admin
    .from("shifts")
    .select(
      "id, user_id, direct_recipient_id, status, department_id, date, shift_type, coverage_start_time, coverage_end_time",
    )
    .eq("id", shiftId)
    .maybeSingle();

  if (
    !shift ||
    shift.direct_recipient_id !== user.id ||
    shift.status !== "open"
  ) {
    return;
  }

  if (isPastShiftPublicationDate(shift.date)) {
    await expireStaleOpenShifts({ shiftId });
    revalidateChatViews(conversationId, shiftId);
    return;
  }

  const { data: request } = await admin
    .from("shift_requests")
    .select(
      "id, interested_user_id, agreement_type, compensation_shift_date, compensation_shift_type",
    )
    .eq("id", requestId)
    .eq("shift_id", shiftId)
    .eq("interested_user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (!request?.agreement_type) return;

  const { data: activeExchange } = await admin
    .from("exchanges")
    .select("id")
    .eq("shift_id", shiftId)
    .in("status", ["accepted", "pending_validation", "approved", "completed"])
    .limit(1)
    .maybeSingle();

  if (activeExchange) return;

  const acceptedDates = [
    shift.date,
    request.agreement_type === "shift_exchange"
      ? request.compensation_shift_date
      : null,
  ].filter((date): date is string => Boolean(date));

  const [ownerDateConflict, recipientDateConflict] = await Promise.all([
    findActiveExchangeDateConflict({
      userId: shift.user_id,
      dates: acceptedDates,
    }),
    findActiveExchangeDateConflict({
      userId: user.id,
      dates: acceptedDates,
    }),
  ]);

  if (ownerDateConflict || recipientDateConflict) {
    await admin
      .from("shift_requests")
      .update({ status: "rejected" })
      .eq("id", requestId)
      .eq("status", "pending");

    await createNotification({
      userId: shift.user_id,
      type: "proposal_rejected",
      title: "Propuesta directa no disponible",
      body: recipientDateConflict
        ? "La persona destinataria ya tiene otro cambio activo en una de las fechas implicadas."
        : "Ya tienes otro cambio activo en una de las fechas implicadas.",
      dedupeKey: `proposal_rejected:${requestId}`,
      data: {
        shift_id: shiftId,
        conversation_id: conversationId ?? undefined,
        action_url: conversationId ? `/chat/${conversationId}` : "/chat",
      },
    });

    revalidateChatViews(conversationId, shiftId);
    return;
  }

  if (
    request.agreement_type === "shift_exchange" &&
    (!request.compensation_shift_date ||
      !request.compensation_shift_type ||
      request.compensation_shift_type === "rest")
  ) {
    await admin
      .from("shift_requests")
      .update({ status: "rejected" })
      .eq("id", requestId)
      .eq("status", "pending");

    revalidateChatViews(conversationId, shiftId);
    return;
  }

  if (
    request.agreement_type === "shift_exchange" &&
    request.compensation_shift_date &&
    request.compensation_shift_type &&
    request.compensation_shift_type !== "rest"
  ) {
    const recipientCalendarConfig = await getUserCalendarInput({
      userId: user.id,
      startDate: request.compensation_shift_date,
      endDate: request.compensation_shift_date,
    });
    const compensationDayCheck = isValidCompensationDay(
      request.compensation_shift_date,
      request.compensation_shift_type as ShiftType,
      recipientCalendarConfig,
    );

    if (!compensationDayCheck.valid) {
      await admin
        .from("shift_requests")
        .update({ status: "rejected" })
        .eq("id", requestId)
        .eq("status", "pending");

      await createNotification({
        userId: shift.user_id,
        type: "proposal_rejected",
        title: "Propuesta directa no disponible",
        body: `El turno de compensacion ya no es valido: ${compensationDayCheck.reason}`,
        dedupeKey: `proposal_rejected:${requestId}`,
        data: {
          shift_id: shiftId,
          conversation_id: conversationId ?? undefined,
          action_url: conversationId ? `/chat/${conversationId}` : "/chat",
        },
      });

      revalidateChatViews(conversationId, shiftId);
      return;
    }

    const activeExchangeLock = await findActiveExchangeSlotLock({
      userId: user.id,
      date: request.compensation_shift_date,
      shiftType: request.compensation_shift_type as ShiftType,
    });

    if (activeExchangeLock) {
      await admin
        .from("shift_requests")
        .update({ status: "rejected" })
        .eq("id", requestId)
        .eq("status", "pending");

      await createNotification({
        userId: shift.user_id,
        type: "proposal_rejected",
        title: "Propuesta directa no disponible",
        body: "El turno de compensacion ya esta comprometido en otro intercambio activo.",
        dedupeKey: `proposal_rejected:${requestId}`,
        data: {
          shift_id: shiftId,
          conversation_id: conversationId ?? undefined,
          action_url: conversationId ? `/chat/${conversationId}` : "/chat",
        },
      });

      revalidateChatViews(conversationId, shiftId);
      return;
    }
  }

  const now = new Date().toISOString();
  const [ownerName, recipientName] = await Promise.all([
    getUserFullName(shift.user_id),
    getUserFullName(user.id),
  ]);

  const { data: createdExchange, error: createExchangeError } = await admin
    .from("exchanges")
    .insert({
      shift_id: shiftId,
      user_a_id: shift.user_id,
      user_b_id: user.id,
      status: "accepted",
      agreement_type: request.agreement_type,
      compensation_shift_date: request.compensation_shift_date ?? null,
      compensation_shift_type: request.compensation_shift_type ?? null,
      coverage_start_time:
        request.agreement_type === "hours_bank"
          ? shift.coverage_start_time ?? null
          : null,
      coverage_end_time:
        request.agreement_type === "hours_bank"
          ? shift.coverage_end_time ?? null
          : null,
      confirmed_at: now,
      signed_by_user_a_at: now,
      signed_by_user_a_name: ownerName,
    })
    .select("id")
    .single();

  if (createExchangeError || !createdExchange) {
    if (createExchangeError && isActiveExchangeSlotLockError(createExchangeError)) {
      await admin
        .from("shift_requests")
        .update({ status: "rejected" })
        .eq("id", requestId)
        .eq("status", "pending");
    }

    revalidateChatViews(conversationId, shiftId);
    return;
  }

  await admin
    .from("shift_requests")
    .update({ status: "accepted" })
    .eq("id", requestId)
    .eq("status", "pending");

  await admin
    .from("shifts")
    .update({ status: "negotiating" })
    .eq("id", shiftId)
    .eq("status", "open");

  await recordExchangeEvent({
    exchangeId: createdExchange.id,
    actorId: user.id,
    eventType: "proposal_accepted",
    title: `${recipientName} ha aceptado la propuesta directa de ${ownerName}`,
    details: getAgreementSummary({
      agreementType: request.agreement_type as ExchangeAgreementType,
      compensationShiftType: request.compensation_shift_type as
        | ShiftType
        | "rest"
        | null,
      compensationShiftDate: request.compensation_shift_date,
      coverageStartTime:
        request.agreement_type === "hours_bank"
          ? shift.coverage_start_time
          : null,
      coverageEndTime:
        request.agreement_type === "hours_bank" ? shift.coverage_end_time : null,
      ownerName,
      requesterName: recipientName,
    }),
    toStatus: "accepted",
  });

  await resolveNotifications({
    userId: user.id,
    dedupeKey: `proposal_received:${requestId}`,
    unresolvedOnly: true,
  });

  await createNotification({
    userId: shift.user_id,
    type: "proposal_accepted",
    title: "Propuesta directa aceptada",
    body: `${recipientName} ha aceptado tu propuesta directa. Falta tu firma para cerrar el intercambio.`,
    dedupeKey: `proposal_accepted:${createdExchange.id}`,
    data: {
      shift_id: shiftId,
      request_id: requestId,
      exchange_id: createdExchange.id,
      conversation_id: conversationId ?? undefined,
      direct: true,
      action_url: `/exchanges/${createdExchange.id}`,
    },
  });

  revalidateChatViews(conversationId, shiftId);
  redirect(`/exchanges/${createdExchange.id}`);
}

export async function rejectDirectProposal(formData: FormData): Promise<void> {
  const requestId = ((formData.get("request_id") as string | null) ?? "").trim();
  const shiftId = ((formData.get("shift_id") as string | null) ?? "").trim();
  const conversationId =
    ((formData.get("conversation_id") as string | null) ?? "").trim() || null;

  if (!requestId || !shiftId) return;

  const supabase = await createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { data: shift } = await admin
    .from("shifts")
    .select("id, user_id, direct_recipient_id, status")
    .eq("id", shiftId)
    .maybeSingle();

  if (
    !shift ||
    shift.direct_recipient_id !== user.id ||
    shift.status !== "open"
  ) {
    return;
  }

  const { data: request } = await admin
    .from("shift_requests")
    .select("id")
    .eq("id", requestId)
    .eq("shift_id", shiftId)
    .eq("interested_user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (!request) return;

  await admin
    .from("shift_requests")
    .update({ status: "rejected" })
    .eq("id", requestId)
    .eq("status", "pending");

  await admin
    .from("shifts")
    .update({ status: "cancelled" })
    .eq("id", shiftId)
    .eq("status", "open");

  const recipientName = await getUserFullName(user.id);

  await resolveNotifications({
    userId: user.id,
    dedupeKey: `proposal_received:${requestId}`,
    unresolvedOnly: true,
  });

  await createNotification({
    userId: shift.user_id,
    type: "proposal_rejected",
    title: "Propuesta directa rechazada",
    body: `${recipientName} ha rechazado tu propuesta directa.`,
    dedupeKey: `proposal_rejected:${requestId}`,
    data: {
      shift_id: shiftId,
      request_id: requestId,
      conversation_id: conversationId ?? undefined,
      direct: true,
      action_url: conversationId ? `/chat/${conversationId}` : "/chat",
    },
  });

  revalidateChatViews(conversationId, shiftId);
}
