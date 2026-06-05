"use server";

import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAccountGateState } from "@/lib/user-profiles";
import {
  canAccessScopedDepartment,
  canReviewDepartmentChangeRequest,
  isSuperAdmin,
} from "@/lib/user-roles";
import type { UserRole, ValidationStatus } from "@/types";

export interface UpdateProfileResult {
  success?: true;
  error?: string;
}

export interface DepartmentChangeMutationResult {
  success?: true;
  error?: string;
}

export interface JobPositionChangeMutationResult {
  success?: true;
  error?: string;
}

export interface LaborPreferencesMutationResult {
  success?: true;
  error?: string;
}

export interface SuperAdminLaborScopeMutationResult {
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

interface JobPositionRow {
  id: string;
  company_id: string;
  department_id: string;
  name: string;
  active: boolean;
}

interface RotationGroupRow {
  id: string;
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

async function getJobPositionChangeApproverIds(
  companyId: string,
  departmentId: string
): Promise<string[]> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("user_profiles")
    .select("id, role, company_id, department_id, validation_status")
    .eq("validation_status", "approved")
    .in("role", ["department_admin", "hr_admin", "super_admin"]);

  if (error) {
    console.error(
      "[profile/actions] Failed to load job position change approvers",
      error.message
    );
    return [];
  }

  return [
    ...new Set(
      ((data ?? []) as ApproverRow[])
        .filter((approver) =>
          canAccessScopedDepartment(approver, {
            company_id: companyId,
            department_id: departmentId,
          })
        )
        .map((approver) => approver.id)
    ),
  ];
}

export async function updateSignatureUrl(
  signatureUrl: string
): Promise<UpdateProfileResult> {
  if (!signatureUrl?.trim()) {
    return { error: "La URL de la firma no es valida." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "No autenticado." };

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("user_profiles")
    .update({ signature_url: signatureUrl.trim() })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { success: true };
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

export async function updateSuperAdminLaborScope(
  formData: FormData
): Promise<SuperAdminLaborScopeMutationResult> {
  const companyId = (formData.get("company_id") as string | null)?.trim();
  const areaDepartmentId = (
    formData.get("area_department_id") as string | null
  )?.trim();
  const departmentId = (
    formData.get("department_id") as string | null
  )?.trim();

  if (!companyId) {
    return { error: "Selecciona una empresa." };
  }

  if (!areaDepartmentId) {
    return { error: "Selecciona un area o taller." };
  }

  if (!departmentId) {
    return { error: "Selecciona un departamento operativo." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "No autenticado." };
  }

  const accountState = await getAccountGateState(user.id);
  if (!isSuperAdmin(accountState?.role)) {
    return {
      error: "Solo un super admin puede cambiar su asignacion laboral directa.",
    };
  }

  const adminClient = createAdminClient();
  const [
    { data: company, error: companyError },
    { data: selectedArea, error: areaError },
    { data: selectedDepartment, error: departmentError },
    { data: departmentChildren, error: departmentChildrenError },
  ] = await Promise.all([
    adminClient
      .from("companies")
      .select("id")
      .eq("id", companyId)
      .maybeSingle(),
    adminClient
      .from("departments")
      .select("id, company_id, parent_department_id, is_assignable, name")
      .eq("id", areaDepartmentId)
      .eq("company_id", companyId)
      .maybeSingle(),
    adminClient
      .from("departments")
      .select("id, company_id, parent_department_id, is_assignable, name")
      .eq("id", departmentId)
      .eq("company_id", companyId)
      .maybeSingle(),
    adminClient
      .from("departments")
      .select("id")
      .eq("parent_department_id", departmentId)
      .limit(1),
  ]);

  if (companyError || areaError || departmentError || departmentChildrenError) {
    return {
      error:
        "No se pudo validar la asignacion con la estructura organizativa actual.",
    };
  }

  if (!company) {
    return { error: "Selecciona una empresa valida." };
  }

  const typedArea = (selectedArea as DepartmentRow | null) ?? null;
  const typedDepartment = (selectedDepartment as DepartmentRow | null) ?? null;

  if (!typedArea || typedArea.parent_department_id) {
    return { error: "Selecciona un area o taller valido." };
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

  const { error } = await adminClient
    .from("user_profiles")
    .update({
      company_id: companyId,
      department_id: departmentId,
      job_position_id: null,
    })
    .eq("id", user.id)
    .eq("role", "super_admin");

  if (error) {
    return { error: "No se pudo actualizar la asignacion. " + error.message };
  }

  revalidatePath("/profile");
  revalidatePath("/shifts");
  revalidatePath("/shifts/new");
  revalidatePath("/calendar");
  revalidatePath("/", "layout");

  return { success: true };
}

export async function updateLaborPreferences(
  formData: FormData
): Promise<LaborPreferencesMutationResult> {
  const areaDepartmentId = (
    formData.get("area_department_id") as string | null
  )?.trim();
  const departmentId = (formData.get("department_id") as string | null)?.trim();
  const jobPositionId =
    (formData.get("job_position_id") as string | null)?.trim() || null;
  const scheduleType = (formData.get("schedule_type") as string | null)?.trim();
  const rotationGroupId =
    (formData.get("rotation_group_id") as string | null)?.trim() || null;

  if (!areaDepartmentId) {
    return { error: "Selecciona un area o taller." };
  }

  if (!departmentId) {
    return { error: "Selecciona un departamento operativo." };
  }

  if (scheduleType !== "3t5" && scheduleType !== "jornada_normal") {
    return { error: "Selecciona un tipo de jornada valido." };
  }

  if (scheduleType === "3t5" && !rotationGroupId) {
    return { error: "Selecciona tu grupo de rotacion." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "No autenticado." };
  }

  const accountState = await getAccountGateState(user.id);
  if (!accountState?.company_id) {
    return {
      error:
        "Tu perfil no tiene una empresa asignada. No se puede guardar la configuracion laboral.",
    };
  }

  const adminClient = createAdminClient();
  const [
    { data: selectedArea, error: areaError },
    { data: selectedDepartment, error: departmentError },
    { data: departmentChildren, error: departmentChildrenError },
    { data: requestedJobPosition, error: jobPositionError },
    { data: rotationGroup, error: rotationGroupError },
  ] = await Promise.all([
    adminClient
      .from("departments")
      .select("id, company_id, parent_department_id, is_assignable, name")
      .eq("id", areaDepartmentId)
      .eq("company_id", accountState.company_id)
      .maybeSingle(),
    adminClient
      .from("departments")
      .select("id, company_id, parent_department_id, is_assignable, name")
      .eq("id", departmentId)
      .eq("company_id", accountState.company_id)
      .maybeSingle(),
    adminClient
      .from("departments")
      .select("id")
      .eq("parent_department_id", departmentId)
      .limit(1),
    jobPositionId
      ? adminClient
          .from("job_positions")
          .select("id, company_id, department_id, name, active")
          .eq("id", jobPositionId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    scheduleType === "3t5" && rotationGroupId
      ? adminClient
          .from("rotation_groups")
          .select("id")
          .eq("id", rotationGroupId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (
    areaError ||
    departmentError ||
    departmentChildrenError ||
    jobPositionError ||
    rotationGroupError
  ) {
    return {
      error:
        "No se pudo validar la configuracion laboral con la estructura actual.",
    };
  }

  const typedArea = (selectedArea as DepartmentRow | null) ?? null;
  const typedDepartment = (selectedDepartment as DepartmentRow | null) ?? null;
  const typedJobPosition = (requestedJobPosition as JobPositionRow | null) ?? null;
  const typedRotationGroup = (rotationGroup as RotationGroupRow | null) ?? null;

  if (!typedArea || typedArea.parent_department_id) {
    return { error: "Selecciona un area o taller valido." };
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
        "El departamento debe ser operativo final, no un area o nodo padre.",
    };
  }

  if (!belongsToSelectedArea) {
    return {
      error: "El departamento elegido no pertenece al area o taller seleccionado.",
    };
  }

  if (jobPositionId) {
    if (!typedJobPosition || !typedJobPosition.active) {
      return { error: "Selecciona un puesto de trabajo activo y valido." };
    }

    if (
      typedJobPosition.company_id !== accountState.company_id ||
      typedJobPosition.department_id !== departmentId
    ) {
      return {
        error:
          "El puesto de trabajo debe pertenecer al departamento operativo elegido.",
      };
    }
  }

  if (scheduleType === "3t5" && !typedRotationGroup) {
    return { error: "El grupo de rotacion seleccionado no existe." };
  }

  const { error: profileUpdateError } = await adminClient
    .from("user_profiles")
    .update({
      department_id: departmentId,
      job_position_id: jobPositionId,
    })
    .eq("id", user.id);

  if (profileUpdateError) {
    return {
      error:
        "No se pudo actualizar tu departamento o puesto. " +
        profileUpdateError.message,
    };
  }

  const { error: schedulePreferenceError } = await adminClient
    .from("user_schedule_preferences")
    .upsert(
      {
        user_id: user.id,
        schedule_type: scheduleType,
      },
      { onConflict: "user_id" }
    );

  if (schedulePreferenceError) {
    return {
      error:
        "No se pudo guardar tu tipo de jornada. " +
        schedulePreferenceError.message,
    };
  }

  if (scheduleType === "3t5" && rotationGroupId) {
    const { error: rotationAssignmentError } = await adminClient
      .from("user_rotation_assignments")
      .upsert(
        {
          user_id: user.id,
          rotation_group_id: rotationGroupId,
        },
        { onConflict: "user_id" }
      );

    if (rotationAssignmentError) {
      return {
        error:
          "No se pudo guardar tu grupo de rotacion. " +
          rotationAssignmentError.message,
      };
    }
  } else {
    const { error: rotationDeleteError } = await adminClient
      .from("user_rotation_assignments")
      .delete()
      .eq("user_id", user.id);

    if (rotationDeleteError) {
      return {
        error:
          "No se pudo limpiar tu grupo de rotacion. " +
          rotationDeleteError.message,
      };
    }
  }

  await Promise.all([
    adminClient
      .from("department_change_requests")
      .update({
        status: "cancelled",
        reviewed_at: new Date().toISOString(),
        review_notes:
          "Cancelada automaticamente porque el usuario actualizo su departamento desde el perfil.",
      })
      .eq("user_id", user.id)
      .eq("status", "pending"),
    adminClient
      .from("job_position_change_requests")
      .update({
        status: "cancelled",
        reviewed_at: new Date().toISOString(),
        review_notes:
          "Cancelada automaticamente porque el usuario actualizo su puesto desde el perfil.",
      })
      .eq("user_id", user.id)
      .eq("status", "pending"),
  ]);

  revalidatePath("/profile");
  revalidatePath("/calendar");
  revalidatePath("/calendar/vacations");
  revalidatePath("/shifts");
  revalidatePath("/shifts/new");
  revalidatePath("/chat");
  revalidatePath("/home");
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

export async function requestJobPositionChange(
  formData: FormData
): Promise<JobPositionChangeMutationResult> {
  const requestedJobPositionId = (
    formData.get("requested_job_position_id") as string | null
  )?.trim();
  const requestReason =
    (formData.get("request_reason") as string | null)?.trim() || null;

  if (!requestedJobPositionId) {
    return { error: "Selecciona el puesto de trabajo que quieres solicitar." };
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

  if (requestedJobPositionId === accountState.job_position_id) {
    return {
      error:
        "El nuevo puesto debe ser distinto del que tienes asignado actualmente.",
    };
  }

  const adminClient = createAdminClient();
  const [
    { data: existingPending, error: pendingError },
    { data: requestedJobPosition, error: requestedJobPositionError },
  ] = await Promise.all([
    adminClient
      .from("job_position_change_requests")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .maybeSingle(),
    adminClient
      .from("job_positions")
      .select("id, company_id, department_id, name, active")
      .eq("id", requestedJobPositionId)
      .maybeSingle(),
  ]);

  if (pendingError || requestedJobPositionError) {
    return {
      error:
        "No se pudo validar la solicitud de cambio de puesto con la estructura laboral actual.",
    };
  }

  if (existingPending) {
    return {
      error:
        "Ya tienes una solicitud de cambio de puesto pendiente de revision.",
    };
  }

  const typedRequestedJobPosition =
    (requestedJobPosition as JobPositionRow | null) ?? null;

  if (!typedRequestedJobPosition || !typedRequestedJobPosition.active) {
    return {
      error: "Selecciona un puesto de trabajo activo y valido para tu perfil.",
    };
  }

  if (
    typedRequestedJobPosition.company_id !== accountState.company_id ||
    typedRequestedJobPosition.department_id !== accountState.department_id
  ) {
    return {
      error:
        "Solo puedes solicitar puestos de trabajo pertenecientes a tu departamento operativo actual.",
    };
  }

  const { data: createdRequest, error: insertError } = await supabase
    .from("job_position_change_requests")
    .insert({
      user_id: user.id,
      company_id: accountState.company_id,
      current_department_id: accountState.department_id,
      current_job_position_id: accountState.job_position_id ?? null,
      requested_job_position_id: requestedJobPositionId,
      request_reason: requestReason,
    })
    .select("id")
    .single();

  if (insertError) {
    return {
      error:
        insertError.code === "23505"
          ? "Ya tienes una solicitud pendiente para revisar."
          : "No se pudo registrar la solicitud de cambio de puesto. " +
            insertError.message,
    };
  }

  const approverIds = await getJobPositionChangeApproverIds(
    accountState.company_id,
    accountState.department_id
  );

  for (const approverId of approverIds) {
    if (approverId === user.id) {
      continue;
    }

    await createNotification({
      userId: approverId,
      type: "job_position_change_requested",
      title: "Cambio de puesto pendiente",
      body: "Hay una nueva solicitud de cambio de puesto esperando revision.",
      dedupeKey: `job_position_change_requested:${createdRequest.id}`,
      data: {
        job_position_change_request_id: createdRequest.id,
        action_url: "/admin/job-position-changes",
      },
    });
  }

  revalidatePath("/profile");
  revalidatePath("/admin");
  revalidatePath("/admin/job-position-changes");

  return { success: true };
}
