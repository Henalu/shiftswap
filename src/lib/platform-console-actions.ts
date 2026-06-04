"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildRequiredPasswordChangeAppMetadata } from "@/lib/auth/required-password-change";
import { validatePasswordPolicy } from "@/lib/auth/password-policy";
import {
  canManagePlatform,
  canOperatePlatformUsers,
  getCurrentPlatformAccess,
  recordPlatformAuditEvent,
} from "@/lib/platform-console";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUserRole } from "@/lib/user-roles";
import type { UserRole } from "@/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CREATABLE_USER_ROLES: readonly UserRole[] = [
  "member",
  "department_admin",
  "hr_admin",
];

function getConsolePath(params: { error?: string; status?: string } = {}) {
  const searchParams = new URLSearchParams();

  if (params.error) searchParams.set("error", params.error);
  if (params.status) searchParams.set("status", params.status);

  const query = searchParams.toString();
  return query ? `/console?${query}` : "/console";
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

async function requirePlatformAccess(options: {
  write?: boolean;
  userOperations?: boolean;
}) {
  const access = await getCurrentPlatformAccess();

  if (!access.ok) {
    redirect(getConsolePath({ error: access.error }));
  }

  if (options.write && !canManagePlatform(access.admin)) {
    redirect(getConsolePath({ error: "permission-denied" }));
  }

  if (options.userOperations && !canOperatePlatformUsers(access.admin)) {
    redirect(getConsolePath({ error: "permission-denied" }));
  }

  return access;
}

function validateTemporaryPassword(password: string, confirmPassword: string) {
  const validation = validatePasswordPolicy(password);

  if (!validation.ok) {
    return validation.error;
  }

  if (password !== confirmPassword) {
    return "password-mismatch";
  }

  return null;
}

async function ensureDepartmentInCompany(input: {
  companyId: string;
  departmentId: string;
  requireAssignable?: boolean;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("departments")
    .select("id, company_id, is_assignable")
    .eq("id", input.departmentId)
    .eq("company_id", input.companyId)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  if (input.requireAssignable && !(data as { is_assignable: boolean }).is_assignable) {
    return false;
  }

  return true;
}

export async function createPlatformCompanyAction(formData: FormData) {
  const access = await requirePlatformAccess({ write: true });
  const name = getString(formData, "companyName");
  const slug = getString(formData, "companySlug").toLowerCase();
  const areaName = getString(formData, "areaName") || "General";
  const departmentName = getString(formData, "departmentName") || "Equipo base";

  if (!name || name.length > 120) {
    redirect(getConsolePath({ error: "invalid-company-name" }));
  }

  if (!SLUG_PATTERN.test(slug) || slug.length > 64) {
    redirect(getConsolePath({ error: "invalid-company-slug" }));
  }

  if (areaName.length > 120 || departmentName.length > 120) {
    redirect(getConsolePath({ error: "invalid-department-name" }));
  }

  const admin = createAdminClient();
  const { data: company, error: companyError } = await admin
    .from("companies")
    .insert({ name, slug })
    .select("id")
    .single();

  if (companyError || !company) {
    redirect(getConsolePath({ error: "company-create-failed" }));
  }

  const companyId = (company as { id: string }).id;
  const { data: area, error: areaError } = await admin
    .from("departments")
    .insert({
      company_id: companyId,
      is_assignable: false,
      name: areaName,
      parent_department_id: null,
    })
    .select("id")
    .single();

  if (!areaError && area) {
    await admin.from("departments").insert({
      company_id: companyId,
      is_assignable: true,
      name: departmentName,
      parent_department_id: (area as { id: string }).id,
    });
  }

  await recordPlatformAuditEvent({
    action: "company.create",
    actor: access.admin,
    companyId,
    metadata: { slug },
    targetId: companyId,
    targetType: "company",
  });

  revalidatePath("/console");
  redirect(getConsolePath({ status: "company-created" }));
}

export async function createPlatformDepartmentAction(formData: FormData) {
  const access = await requirePlatformAccess({ write: true });
  const companyId = getString(formData, "companyId");
  const parentDepartmentId = getString(formData, "parentDepartmentId");
  const name = getString(formData, "departmentName");

  if (!isUuid(companyId) || !name || name.length > 120) {
    redirect(getConsolePath({ error: "invalid-department" }));
  }

  if (parentDepartmentId && !isUuid(parentDepartmentId)) {
    redirect(getConsolePath({ error: "invalid-department" }));
  }

  if (
    parentDepartmentId &&
    !(await ensureDepartmentInCompany({
      companyId,
      departmentId: parentDepartmentId,
    }))
  ) {
    redirect(getConsolePath({ error: "invalid-department-scope" }));
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("departments")
    .insert({
      company_id: companyId,
      is_assignable: Boolean(parentDepartmentId),
      name,
      parent_department_id: parentDepartmentId || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect(getConsolePath({ error: "department-create-failed" }));
  }

  await recordPlatformAuditEvent({
    action: "department.create",
    actor: access.admin,
    companyId,
    metadata: { name, parentDepartmentId: parentDepartmentId || null },
    targetId: (data as { id: string }).id,
    targetType: "department",
  });

  revalidatePath("/console");
  redirect(getConsolePath({ status: "department-created" }));
}

export async function createPlatformJobPositionAction(formData: FormData) {
  const access = await requirePlatformAccess({ write: true });
  const companyId = getString(formData, "companyId");
  const departmentId = getString(formData, "departmentId");
  const name = getString(formData, "jobPositionName");
  const code = getString(formData, "jobPositionCode");

  if (!isUuid(companyId) || !isUuid(departmentId) || !name || name.length > 120) {
    redirect(getConsolePath({ error: "invalid-job-position" }));
  }

  if (
    !(await ensureDepartmentInCompany({
      companyId,
      departmentId,
      requireAssignable: true,
    }))
  ) {
    redirect(getConsolePath({ error: "invalid-department-scope" }));
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("job_positions")
    .insert({
      code: code || null,
      company_id: companyId,
      department_id: departmentId,
      name,
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect(getConsolePath({ error: "job-position-create-failed" }));
  }

  await recordPlatformAuditEvent({
    action: "job_position.create",
    actor: access.admin,
    companyId,
    metadata: { code: code || null, name },
    targetId: (data as { id: string }).id,
    targetType: "job_position",
  });

  revalidatePath("/console");
  redirect(getConsolePath({ status: "job-position-created" }));
}

export async function updatePlatformScheduleConfigAction(formData: FormData) {
  const access = await requirePlatformAccess({ write: true });
  const departmentId = getString(formData, "departmentId");
  const scheduleType = getString(formData, "scheduleType");

  if (
    !isUuid(departmentId) ||
    (scheduleType !== "3t5" && scheduleType !== "jornada_normal")
  ) {
    redirect(getConsolePath({ error: "invalid-schedule-config" }));
  }

  const admin = createAdminClient();
  const { data: department } = await admin
    .from("departments")
    .select("id, company_id")
    .eq("id", departmentId)
    .maybeSingle();

  if (!department) {
    redirect(getConsolePath({ error: "invalid-schedule-config" }));
  }

  const companyId = (department as { company_id: string }).company_id;
  const { error } = await admin.from("area_schedule_configs").upsert(
    {
      department_id: departmentId,
      schedule_type: scheduleType,
    },
    { onConflict: "department_id" }
  );

  if (error) {
    redirect(getConsolePath({ error: "schedule-config-save-failed" }));
  }

  await recordPlatformAuditEvent({
    action: "schedule_config.upsert",
    actor: access.admin,
    companyId,
    metadata: { scheduleType },
    targetId: departmentId,
    targetType: "department",
  });

  revalidatePath("/console");
  redirect(getConsolePath({ status: "schedule-config-saved" }));
}

export async function createPlatformUserAction(formData: FormData) {
  const access = await requirePlatformAccess({ write: true });
  const email = normalizeEmail(getString(formData, "email"));
  const fullName = getString(formData, "fullName");
  const companyId = getString(formData, "companyId");
  const departmentId = getString(formData, "departmentId");
  const jobPositionId = getString(formData, "jobPositionId");
  const role = getString(formData, "role") as UserRole;
  const temporaryPassword = getString(formData, "temporaryPassword");
  const confirmTemporaryPassword = getString(formData, "confirmTemporaryPassword");

  if (!EMAIL_PATTERN.test(email) || email.length > 254 || !fullName || fullName.length > 120) {
    redirect(getConsolePath({ error: "invalid-user" }));
  }

  if (!isUuid(companyId) || !isUuid(departmentId)) {
    redirect(getConsolePath({ error: "invalid-user-scope" }));
  }

  if (
    !isUserRole(role) ||
    !CREATABLE_USER_ROLES.includes(role) ||
    !(await ensureDepartmentInCompany({
      companyId,
      departmentId,
      requireAssignable: true,
    }))
  ) {
    redirect(getConsolePath({ error: "invalid-user-role" }));
  }

  if (jobPositionId && !isUuid(jobPositionId)) {
    redirect(getConsolePath({ error: "invalid-job-position" }));
  }

  const passwordError = validateTemporaryPassword(
    temporaryPassword,
    confirmTemporaryPassword
  );

  if (passwordError) {
    redirect(getConsolePath({ error: passwordError }));
  }

  const admin = createAdminClient();
  let createdUserId: string | null = null;

  const { data: createdUser, error: authError } =
    await admin.auth.admin.createUser({
      app_metadata: buildRequiredPasswordChangeAppMetadata(),
      email,
      email_confirm: true,
      password: temporaryPassword,
      user_metadata: {
        full_name: fullName,
      },
    });

  if (authError || !createdUser.user) {
    redirect(getConsolePath({ error: "auth-user-create-failed" }));
  }

  createdUserId = createdUser.user.id;

  const { error: profileError } = await admin.from("user_profiles").insert({
    company_id: companyId,
    department_id: departmentId,
    email,
    full_name: fullName,
    id: createdUserId,
    is_admin: role !== "member",
    job_position_id: jobPositionId || null,
    role,
    validation_status: "approved",
    validated_at: new Date().toISOString(),
    validation_notes: "Creado desde Console con contrasena temporal.",
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(createdUserId);
    redirect(getConsolePath({ error: "profile-create-failed" }));
  }

  await recordPlatformAuditEvent({
    action: "user.create_with_temporary_password",
    actor: access.admin,
    companyId,
    metadata: { email, role },
    targetId: createdUserId,
    targetType: "user_profile",
  });

  revalidatePath("/console");
  redirect(getConsolePath({ status: "user-created" }));
}

export async function resetPlatformUserPasswordAction(formData: FormData) {
  const access = await requirePlatformAccess({ userOperations: true });
  const userId = getString(formData, "userId");
  const password = getString(formData, "temporaryPassword");
  const confirmPassword = getString(formData, "confirmTemporaryPassword");

  if (!isUuid(userId)) {
    redirect(getConsolePath({ error: "invalid-user" }));
  }

  const passwordError = validateTemporaryPassword(password, confirmPassword);

  if (passwordError) {
    redirect(getConsolePath({ error: passwordError }));
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("id, company_id, email")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    redirect(getConsolePath({ error: "user-not-found" }));
  }

  const { data: authUserData, error: authUserError } =
    await admin.auth.admin.getUserById(userId);

  if (authUserError || !authUserData.user) {
    redirect(getConsolePath({ error: "auth-user-not-found" }));
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: buildRequiredPasswordChangeAppMetadata(
      authUserData.user.app_metadata
    ),
    password,
  });

  if (error) {
    redirect(getConsolePath({ error: "password-reset-failed" }));
  }

  await recordPlatformAuditEvent({
    action: "user.password_reset_required",
    actor: access.admin,
    companyId: (profile as { company_id: string | null }).company_id,
    metadata: { email: (profile as { email: string }).email },
    targetId: userId,
    targetType: "user_profile",
  });

  revalidatePath("/console");
  redirect(getConsolePath({ status: "password-reset" }));
}
