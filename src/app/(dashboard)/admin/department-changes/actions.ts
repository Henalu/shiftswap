"use server";

import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/notifications";
import { pickFirstRelation } from "@/lib/supabase-relations";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAccountGateState } from "@/lib/user-profiles";
import {
  canReviewDepartmentChangeRequest,
  hasAdminPanelAccess,
  type ScopedRoleUser,
} from "@/lib/user-roles";

export interface DepartmentChangeReviewResult {
  success?: true;
  error?: string;
}

function areProfileChangeApprovalsEnabled() {
  return false;
}

interface DepartmentChangeTarget {
  id: string;
  user_id: string;
  company_id: string;
  current_department_id: string;
  requested_department_id: string;
  status: string;
  user: {
    id: string;
    full_name: string;
  };
  current_department: {
    name: string;
  };
  requested_department: {
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

async function getDepartmentChangeTarget(
  requestId: string
): Promise<DepartmentChangeTarget | null> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("department_change_requests")
    .select(
      `
      id, user_id, company_id, current_department_id, requested_department_id, status,
      user:user_profiles!user_id(id, full_name),
      current_department:departments!department_change_requests_current_department_fk(name),
      requested_department:departments!department_change_requests_requested_department_fk(name)
    `
    )
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    console.error(
      "[admin/department-changes] Failed to load request target",
      error.message
    );
    return null;
  }

  if (!data) {
    return null;
  }

  const typed = data as DepartmentChangeTarget & {
    user: DepartmentChangeTarget["user"] | DepartmentChangeTarget["user"][];
    current_department:
      | DepartmentChangeTarget["current_department"]
      | DepartmentChangeTarget["current_department"][];
    requested_department:
      | DepartmentChangeTarget["requested_department"]
      | DepartmentChangeTarget["requested_department"][];
  };

  return {
    ...typed,
    user: pickFirstRelation(typed.user) ?? typed.user,
    current_department:
      pickFirstRelation(typed.current_department) ?? typed.current_department,
    requested_department:
      pickFirstRelation(typed.requested_department) ?? typed.requested_department,
  };
}

function revalidateDepartmentChangeViews() {
  revalidatePath("/profile");
  revalidatePath("/admin");
  revalidatePath("/admin/department-changes");
  revalidatePath("/shifts");
  revalidatePath("/shifts/my");
}

export async function approveDepartmentChangeRequest(
  formData: FormData
): Promise<DepartmentChangeReviewResult> {
  if (!areProfileChangeApprovalsEnabled()) {
    return {
      error:
        "Las aprobaciones de cambios de departamento estan desactivadas. Los usuarios actualizan estos datos desde Mi perfil.",
    };
  }

  const requestId = (formData.get("request_id") as string | null)?.trim();
  const reviewNotes =
    (formData.get("review_notes") as string | null)?.trim() || null;

  if (!requestId) {
    return { error: "La solicitud de cambio es invalida." };
  }

  const actor = await getAuthenticatedAdminActor();
  if (!actor) {
    return { error: "No tienes permisos para revisar cambios de departamento." };
  }

  const target = await getDepartmentChangeTarget(requestId);
  if (!target || target.status !== "pending") {
    return { error: "La solicitud ya no esta pendiente de revision." };
  }

  if (
    target.user_id === actor.id ||
    !canReviewDepartmentChangeRequest(actor, {
      company_id: target.company_id,
      current_department_id: target.current_department_id,
      requested_department_id: target.requested_department_id,
    })
  ) {
    return { error: "No puedes resolver esta solicitud por alcance." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_department_change_request", {
    target_request_id: requestId,
    next_status: "approved",
    review_notes_input: reviewNotes,
  });

  if (error) {
    return {
      error:
        "No se pudo aprobar el cambio de departamento. " + error.message,
    };
  }

  await createNotification({
    userId: target.user_id,
    type: "department_change_approved",
    title: "Cambio de departamento aprobado",
    body: `Tu solicitud para pasar a ${target.requested_department.name} ha sido aprobada.`,
    dedupeKey: `department_change_resolution:${requestId}`,
    data: {
      department_change_request_id: requestId,
      action_url: "/profile",
    },
  });

  revalidateDepartmentChangeViews();
  return { success: true };
}

export async function rejectDepartmentChangeRequest(
  formData: FormData
): Promise<DepartmentChangeReviewResult> {
  if (!areProfileChangeApprovalsEnabled()) {
    return {
      error:
        "Las aprobaciones de cambios de departamento estan desactivadas. Los usuarios actualizan estos datos desde Mi perfil.",
    };
  }

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
    return { error: "No tienes permisos para revisar cambios de departamento." };
  }

  const target = await getDepartmentChangeTarget(requestId);
  if (!target || target.status !== "pending") {
    return { error: "La solicitud ya no esta pendiente de revision." };
  }

  if (
    target.user_id === actor.id ||
    !canReviewDepartmentChangeRequest(actor, {
      company_id: target.company_id,
      current_department_id: target.current_department_id,
      requested_department_id: target.requested_department_id,
    })
  ) {
    return { error: "No puedes resolver esta solicitud por alcance." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_department_change_request", {
    target_request_id: requestId,
    next_status: "rejected",
    review_notes_input: reviewNotes,
  });

  if (error) {
    return {
      error:
        "No se pudo rechazar el cambio de departamento. " + error.message,
    };
  }

  await createNotification({
    userId: target.user_id,
    type: "department_change_rejected",
    title: "Cambio de departamento rechazado",
    body: `Tu solicitud para pasar a ${target.requested_department.name} necesita revision antes de poder aprobarse.`,
    dedupeKey: `department_change_resolution:${requestId}`,
    data: {
      department_change_request_id: requestId,
      action_url: "/profile",
    },
  });

  revalidateDepartmentChangeViews();
  return { success: true };
}
