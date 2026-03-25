"use server";

import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/notifications";
import { pickFirstRelation } from "@/lib/supabase-relations";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAccountGateState } from "@/lib/user-profiles";
import {
  canAccessScopedDepartment,
  hasAdminPanelAccess,
  type ScopedRoleUser,
} from "@/lib/user-roles";

export interface JobPositionChangeReviewResult {
  success?: true;
  error?: string;
}

interface JobPositionChangeTarget {
  id: string;
  user_id: string;
  company_id: string;
  current_department_id: string;
  requested_job_position_id: string;
  status: string;
  user: {
    id: string;
    full_name: string;
  };
  current_department: {
    name: string;
  };
  requested_job_position: {
    name: string;
  };
}

async function getAuthenticatedAdminActor(): Promise<
  (ScopedRoleUser & { id: string }) | null
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const accountState = await getAccountGateState(user.id);
  if (!accountState || !hasAdminPanelAccess(accountState.role)) {
    return null;
  }

  return {
    id: user.id,
    role: accountState.role,
    company_id: accountState.company_id,
    department_id: accountState.department_id,
  };
}

async function getJobPositionChangeTarget(
  requestId: string
): Promise<JobPositionChangeTarget | null> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("job_position_change_requests")
    .select(
      `
      id, user_id, company_id, current_department_id, requested_job_position_id, status,
      user:user_profiles!user_id(id, full_name),
      current_department:departments!current_department_id(name),
      requested_job_position:job_positions!requested_job_position_id(name)
    `
    )
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    console.error(
      "[admin/job-position-changes] Failed to load request target",
      error.message
    );
    return null;
  }

  if (!data) {
    return null;
  }

  const typed = data as JobPositionChangeTarget & {
    user: JobPositionChangeTarget["user"] | JobPositionChangeTarget["user"][];
    current_department:
      | JobPositionChangeTarget["current_department"]
      | JobPositionChangeTarget["current_department"][];
    requested_job_position:
      | JobPositionChangeTarget["requested_job_position"]
      | JobPositionChangeTarget["requested_job_position"][];
  };

  return {
    ...typed,
    user: pickFirstRelation(typed.user) ?? typed.user,
    current_department:
      pickFirstRelation(typed.current_department) ?? typed.current_department,
    requested_job_position:
      pickFirstRelation(typed.requested_job_position) ?? typed.requested_job_position,
  };
}

function revalidateJobPositionChangeViews() {
  revalidatePath("/profile");
  revalidatePath("/admin");
  revalidatePath("/admin/job-position-changes");
}

export async function approveJobPositionChangeRequest(
  formData: FormData
): Promise<JobPositionChangeReviewResult> {
  const requestId = (formData.get("request_id") as string | null)?.trim();
  const reviewNotes =
    (formData.get("review_notes") as string | null)?.trim() || null;

  if (!requestId) {
    return { error: "La solicitud de cambio es invalida." };
  }

  const actor = await getAuthenticatedAdminActor();
  if (!actor) {
    return { error: "No tienes permisos para revisar cambios de puesto." };
  }

  const target = await getJobPositionChangeTarget(requestId);
  if (!target || target.status !== "pending") {
    return { error: "La solicitud ya no esta pendiente de revision." };
  }

  if (
    target.user_id === actor.id ||
    !canAccessScopedDepartment(actor, {
      company_id: target.company_id,
      department_id: target.current_department_id,
    })
  ) {
    return { error: "No puedes resolver esta solicitud por alcance." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_job_position_change_request", {
    target_request_id: requestId,
    next_status: "approved",
    review_notes_input: reviewNotes,
  });

  if (error) {
    return {
      error: "No se pudo aprobar el cambio de puesto. " + error.message,
    };
  }

  await createNotification({
    userId: target.user_id,
    type: "job_position_change_approved",
    title: "Cambio de puesto aprobado",
    body: `Tu solicitud para pasar a ${target.requested_job_position.name} ha sido aprobada.`,
    dedupeKey: `job_position_change_resolution:${requestId}`,
    data: {
      job_position_change_request_id: requestId,
      action_url: "/profile",
    },
  });

  revalidateJobPositionChangeViews();
  return { success: true };
}

export async function rejectJobPositionChangeRequest(
  formData: FormData
): Promise<JobPositionChangeReviewResult> {
  const requestId = (formData.get("request_id") as string | null)?.trim();
  const reviewNotes = (formData.get("review_notes") as string | null)?.trim();

  if (!requestId) {
    return { error: "La solicitud de cambio es invalida." };
  }

  if (!reviewNotes) {
    return { error: "Indica el motivo del rechazo antes de continuar." };
  }

  const actor = await getAuthenticatedAdminActor();
  if (!actor) {
    return { error: "No tienes permisos para revisar cambios de puesto." };
  }

  const target = await getJobPositionChangeTarget(requestId);
  if (!target || target.status !== "pending") {
    return { error: "La solicitud ya no esta pendiente de revision." };
  }

  if (
    target.user_id === actor.id ||
    !canAccessScopedDepartment(actor, {
      company_id: target.company_id,
      department_id: target.current_department_id,
    })
  ) {
    return { error: "No puedes resolver esta solicitud por alcance." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_job_position_change_request", {
    target_request_id: requestId,
    next_status: "rejected",
    review_notes_input: reviewNotes,
  });

  if (error) {
    return {
      error: "No se pudo rechazar el cambio de puesto. " + error.message,
    };
  }

  await createNotification({
    userId: target.user_id,
    type: "job_position_change_rejected",
    title: "Cambio de puesto rechazado",
    body: `Tu solicitud para pasar a ${target.requested_job_position.name} necesita revision antes de poder aprobarse.`,
    dedupeKey: `job_position_change_resolution:${requestId}`,
    data: {
      job_position_change_request_id: requestId,
      action_url: "/profile",
    },
  });

  revalidateJobPositionChangeViews();
  return { success: true };
}
