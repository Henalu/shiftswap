"use server";

import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAccountGateState } from "@/lib/user-profiles";
import { canReviewDepartmentChangeRequest } from "@/lib/user-roles";
import type { UserRole, ValidationStatus } from "@/types";

export interface UpdateProfileResult {
  success?: true;
  error?: string;
}

export interface DepartmentChangeMutationResult {
  success?: true;
  error?: string;
}

interface DepartmentRow {
  id: string;
  company_id: string;
  parent_department_id: string | null;
  is_assignable: boolean;
  name: string;
}

interface ApproverRow {
  id: string;
  role: UserRole;
  company_id: string | null;
  department_id: string | null;
  validation_status: ValidationStatus;
}

async function getDepartmentChangeApproverIds(
  companyId: string,
  currentDepartmentId: string,
  requestedDepartmentId: string
): Promise<string[]> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("user_profiles")
    .select("id, role, company_id, department_id, validation_status")
    .eq("validation_status", "approved")
    .in("role", ["department_admin", "hr_admin", "super_admin"]);

  if (error) {
    console.error(
      "[profile/actions] Failed to load department change approvers",
      error.message
    );
    return [];
  }

  return [...new Set(
    ((data ?? []) as ApproverRow[])
      .filter((approver) =>
        canReviewDepartmentChangeRequest(approver, {
          company_id: companyId,
          current_department_id: currentDepartmentId,
          requested_department_id: requestedDepartmentId,
        })
      )
      .map((approver) => approver.id)
  )];
}

export async function updateProfile(
  formData: FormData
): Promise<UpdateProfileResult> {
  const fullName = (formData.get("full_name") as string | null)?.trim();
  const phone = (formData.get("phone") as string | null)?.trim() || null;
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const avatarUrl = (formData.get("avatar_url") as string | null)?.trim() || undefined;

  if (!fullName) return { error: "El nombre completo es obligatorio." };
  if (!email) return { error: "El email de contacto es obligatorio." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "No autenticado." };

  const adminClient = createAdminClient();
  const { data: existingProfile, error: existingProfileError } = await adminClient
    .from("user_profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfileError) {
    return { error: existingProfileError.message };
  }

  if (!existingProfile) {
    return { error: "No se encontró tu perfil de usuario." };
  }

  const updates: Record<string, unknown> = {
    full_name: fullName,
    phone,
    email,
  };

  if (avatarUrl !== undefined) {
    updates.avatar_url = avatarUrl;
  }

  const { error } = await adminClient
    .from("user_profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function requestDepartmentChange(
  formData: FormData
): Promise<DepartmentChangeMutationResult> {
  const requestedDepartmentId = (
    formData.get("requested_department_id") as string | null
  )?.trim();
  const areaDepartmentId = (
    formData.get("area_department_id") as string | null
  )?.trim();
  const requestReason =
    (formData.get("request_reason") as string | null)?.trim() || null;

  if (!areaDepartmentId) {
    return { error: "Selecciona primero el area o taller de destino." };
  }

  if (!requestedDepartmentId) {
    return { error: "Selecciona el departamento operativo de destino." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "No autenticado." };
  }

  const accountState = await getAccountGateState(user.id);
  if (!accountState?.company_id || !accountState.department_id) {
    return {
      error:
        "Tu perfil no tiene una asignacion laboral valida. Revisa tus datos actuales antes de solicitar el cambio.",
    };
  }

  if (requestedDepartmentId === accountState.department_id) {
    return {
      error: "El nuevo departamento debe ser distinto del que tienes asignado ahora.",
    };
  }

  const adminClient = createAdminClient();
  const [
    { data: existingPending, error: pendingError },
    { data: selectedArea, error: areaError },
    { data: requestedDepartment, error: departmentError },
    { data: departmentChildren, error: departmentChildrenError },
  ] = await Promise.all([
    adminClient
      .from("department_change_requests")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .maybeSingle(),
    adminClient
      .from("departments")
      .select("id, company_id, parent_department_id, is_assignable, name")
      .eq("id", areaDepartmentId)
      .eq("company_id", accountState.company_id)
      .maybeSingle(),
    adminClient
      .from("departments")
      .select("id, company_id, parent_department_id, is_assignable, name")
      .eq("id", requestedDepartmentId)
      .eq("company_id", accountState.company_id)
      .maybeSingle(),
    adminClient
      .from("departments")
      .select("id")
      .eq("parent_department_id", requestedDepartmentId)
      .limit(1),
  ]);

  if (pendingError || areaError || departmentError || departmentChildrenError) {
    return {
      error:
        "No se pudo validar la solicitud de cambio con la estructura organizativa actual.",
    };
  }

  if (existingPending) {
    return {
      error:
        "Ya tienes una solicitud de cambio de departamento pendiente de revision.",
    };
  }

  const typedArea = (selectedArea as DepartmentRow | null) ?? null;
  const typedDepartment = (requestedDepartment as DepartmentRow | null) ?? null;

  if (!typedArea || typedArea.parent_department_id) {
    return { error: "Selecciona un area o taller de destino valido." };
  }

  if (!typedDepartment) {
    return { error: "Selecciona un departamento operativo valido." };
  }

  const isOperationalDepartment =
    typedDepartment.is_assignable && (departmentChildren?.length ?? 0) === 0;
  const belongsToSelectedArea =
    typedDepartment.parent_department_id === areaDepartmentId ||
    typedDepartment.id === areaDepartmentId;

  if (!isOperationalDepartment) {
    return {
      error:
        "El destino debe ser un departamento operativo final, no un nodo padre.",
    };
  }

  if (!belongsToSelectedArea) {
    return {
      error:
        "El departamento elegido no pertenece al area o taller seleccionado.",
    };
  }

  const { data: createdRequest, error: insertError } = await supabase
    .from("department_change_requests")
    .insert({
      user_id: user.id,
      company_id: accountState.company_id,
      current_department_id: accountState.department_id,
      requested_department_id: requestedDepartmentId,
      request_reason: requestReason,
    })
    .select("id")
    .single();

  if (insertError) {
    return {
      error:
        insertError.code === "23505"
          ? "Ya tienes una solicitud pendiente para revisar."
          : "No se pudo registrar la solicitud de cambio. " + insertError.message,
    };
  }

  const approverIds = await getDepartmentChangeApproverIds(
    accountState.company_id,
    accountState.department_id,
    requestedDepartmentId
  );

  for (const approverId of approverIds) {
    if (approverId === user.id) {
      continue;
    }

    await createNotification({
      userId: approverId,
      type: "department_change_requested",
      title: "Cambio de departamento pendiente",
      body: "Hay una nueva solicitud de cambio de departamento esperando revision.",
      dedupeKey: `department_change_requested:${createdRequest.id}`,
      data: {
        department_change_request_id: createdRequest.id,
        action_url: "/admin/department-changes",
      },
    });
  }

  revalidatePath("/profile");
  revalidatePath("/admin");
  revalidatePath("/admin/department-changes");

  return { success: true };
}
