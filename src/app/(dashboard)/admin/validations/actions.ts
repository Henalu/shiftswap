"use server";

import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAccountGateState } from "@/lib/user-profiles";
import {
  canAccessScopedProfile,
  hasAdminPanelAccess,
} from "@/lib/user-roles";
import type { ValidationStatus } from "@/types";

const ID_CARD_BUCKET = "id-cards";

export interface ValidationMutationResult {
  success?: true;
  error?: string;
}

interface ValidationTarget {
  id: string;
  full_name: string;
  company_id: string | null;
  department_id: string | null;
  id_card_url: string | null;
  validation_status: ValidationStatus;
}

async function getAuthenticatedAdminActor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const accountState = await getAccountGateState(user.id);
  if (!accountState || !hasAdminPanelAccess(accountState.role)) {
    return null;
  }

  return {
    id: user.id,
    ...accountState,
  };
}

async function getValidationTarget(
  userId: string
): Promise<ValidationTarget | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      "id, full_name, company_id, department_id, id_card_url, validation_status"
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[admin/validations] Failed to load validation target", {
      userId,
      message: error.message,
    });
    return null;
  }

  return (data as ValidationTarget | null) ?? null;
}

async function deleteIdCard(path: string | null): Promise<string | null> {
  if (!path) return null;

  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(ID_CARD_BUCKET).remove([path]);

  return error?.message ?? null;
}

function revalidateValidationViews(userId: string) {
  revalidatePath("/admin/validations");
  revalidatePath(`/admin/validations/${userId}`);
  revalidatePath("/pending-validation");
  revalidatePath("/", "layout");
}

export async function approveUser(
  formData: FormData
): Promise<ValidationMutationResult> {
  const targetUserId = (formData.get("user_id") as string | null)?.trim();
  if (!targetUserId) {
    return { error: "La solicitud de validación es inválida." };
  }

  const actor = await getAuthenticatedAdminActor();
  if (!actor) {
    return { error: "No tienes permisos para validar empleados." };
  }

  const target = await getValidationTarget(targetUserId);
  if (!target || target.validation_status !== "pending") {
    return { error: "La cuenta ya no está pendiente de revisión." };
  }

  if (!canAccessScopedProfile(actor, target)) {
    return { error: "No puedes validar esta solicitud por alcance." };
  }

  const deleteError = await deleteIdCard(target.id_card_url);
  if (deleteError) {
    return {
      error:
        "No se pudo borrar el carné antes de aprobar la cuenta. " + deleteError,
    };
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("user_profiles")
    .update({
      validation_status: "approved",
      validated_by: actor.id,
      validated_at: now,
      validation_notes: null,
      id_card_url: null,
    })
    .eq("id", targetUserId)
    .eq("validation_status", "pending");

  if (updateError) {
    return { error: "No se pudo aprobar la cuenta. " + updateError.message };
  }

  await createNotification({
    userId: targetUserId,
    type: "account_approved",
    title: "Cuenta aprobada",
    body: "Tu cuenta ya está activa y puedes acceder a ShiftSwap.",
    dedupeKey: `account_validation:${targetUserId}`,
    data: {
      action_url: "/",
    },
  });

  revalidateValidationViews(targetUserId);
  return { success: true };
}

export async function rejectUser(
  formData: FormData
): Promise<ValidationMutationResult> {
  const targetUserId = (formData.get("user_id") as string | null)?.trim();
  const validationNotes = (
    formData.get("validation_notes") as string | null
  )?.trim();

  if (!targetUserId) {
    return { error: "La solicitud de validación es inválida." };
  }

  if (!validationNotes) {
    return { error: "Debes indicar el motivo del rechazo." };
  }

  const actor = await getAuthenticatedAdminActor();
  if (!actor) {
    return { error: "No tienes permisos para validar empleados." };
  }

  const target = await getValidationTarget(targetUserId);
  if (!target || target.validation_status !== "pending") {
    return { error: "La cuenta ya no está pendiente de revisión." };
  }

  if (!canAccessScopedProfile(actor, target)) {
    return { error: "No puedes validar esta solicitud por alcance." };
  }

  const deleteError = await deleteIdCard(target.id_card_url);
  if (deleteError) {
    return {
      error:
        "No se pudo borrar el carné antes de rechazar la cuenta. " + deleteError,
    };
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("user_profiles")
    .update({
      validation_status: "rejected",
      validated_by: actor.id,
      validated_at: now,
      validation_notes: validationNotes,
      id_card_url: null,
    })
    .eq("id", targetUserId)
    .eq("validation_status", "pending");

  if (updateError) {
    return { error: "No se pudo rechazar la cuenta. " + updateError.message };
  }

  await createNotification({
    userId: targetUserId,
    type: "account_rejected",
    title: "Cuenta rechazada",
    body: "Tu solicitud necesita correcciones antes de poder activarse.",
    dedupeKey: `account_validation:${targetUserId}`,
    data: {
      action_url: "/pending-validation",
    },
  });

  revalidateValidationViews(targetUserId);
  return { success: true };
}
