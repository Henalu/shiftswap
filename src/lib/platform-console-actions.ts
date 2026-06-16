"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildRequiredPasswordChangeAppMetadata } from "@/lib/auth/required-password-change";
import { validatePasswordPolicy } from "@/lib/auth/password-policy";
import {
  buildCompanyThemeConfig,
  normalizeHexColor,
} from "@/lib/company-theme";
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

type AdminClient = ReturnType<typeof createAdminClient>;

interface ConsoleDepartmentRow {
  company_id: string;
  id: string;
  is_assignable: boolean;
  name: string;
  parent_department_id: string | null;
}

interface ConsoleJobPositionRow {
  active: boolean;
  code: string | null;
  company_id: string;
  department_id: string;
  id: string;
  name: string;
}

function getConsolePath(params: { error?: string; status?: string } = {}) {
  return getPlatformFeedbackPath("/console", params);
}

function getPlatformFeedbackPath(
  returnTo: string,
  params: { error?: string; status?: string } = {}
) {
  const searchParams = new URLSearchParams();
  const path = returnTo === "/admin/platform" ? "/admin/platform" : "/console";

  if (params.error) searchParams.set("error", params.error);
  if (params.status) searchParams.set("status", params.status);

  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getReturnPath(formData: FormData) {
  const value = getString(formData, "returnTo");
  return value === "/admin/platform" ? "/admin/platform" : "/console";
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
}, returnTo = "/console") {
  const access = await getCurrentPlatformAccess();

  if (!access.ok) {
    redirect(getPlatformFeedbackPath(returnTo, { error: access.error }));
  }

  if (options.write && !canManagePlatform(access.admin)) {
    redirect(getPlatformFeedbackPath(returnTo, { error: "permission-denied" }));
  }

  if (options.userOperations && !canOperatePlatformUsers(access.admin)) {
    redirect(getPlatformFeedbackPath(returnTo, { error: "permission-denied" }));
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

async function getConsoleDepartment(
  admin: AdminClient,
  departmentId: string
) {
  const { data, error } = await admin
    .from("departments")
    .select("id, company_id, name, parent_department_id, is_assignable")
    .eq("id", departmentId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as ConsoleDepartmentRow;
}

async function getConsoleJobPosition(
  admin: AdminClient,
  jobPositionId: string
) {
  const { data, error } = await admin
    .from("job_positions")
    .select("id, company_id, department_id, name, code, active")
    .eq("id", jobPositionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as ConsoleJobPositionRow;
}

async function tableHasRows(
  admin: AdminClient,
  table: string,
  column: string,
  value: string
) {
  const { data, error } = await admin
    .from(table)
    .select("id")
    .eq(column, value)
    .limit(1);

  if (error) {
    console.error("[platform-console] Failed dependency check", {
      column,
      message: error.message,
      table,
    });
    return true;
  }

  return (data ?? []).length > 0;
}

async function departmentHasBlockingReferences(
  admin: AdminClient,
  departmentId: string
) {
  const checks = await Promise.all([
    tableHasRows(admin, "departments", "parent_department_id", departmentId),
    tableHasRows(admin, "user_profiles", "department_id", departmentId),
    tableHasRows(admin, "shifts", "department_id", departmentId),
    tableHasRows(admin, "job_positions", "department_id", departmentId),
    tableHasRows(
      admin,
      "department_change_requests",
      "current_department_id",
      departmentId
    ),
    tableHasRows(
      admin,
      "department_change_requests",
      "requested_department_id",
      departmentId
    ),
    tableHasRows(
      admin,
      "job_position_change_requests",
      "current_department_id",
      departmentId
    ),
  ]);

  return checks.some(Boolean);
}

async function departmentHasOperationalReferences(
  admin: AdminClient,
  departmentId: string
) {
  const checks = await Promise.all([
    tableHasRows(admin, "user_profiles", "department_id", departmentId),
    tableHasRows(admin, "shifts", "department_id", departmentId),
    tableHasRows(admin, "job_positions", "department_id", departmentId),
    tableHasRows(
      admin,
      "department_change_requests",
      "current_department_id",
      departmentId
    ),
    tableHasRows(
      admin,
      "department_change_requests",
      "requested_department_id",
      departmentId
    ),
    tableHasRows(
      admin,
      "job_position_change_requests",
      "current_department_id",
      departmentId
    ),
  ]);

  return checks.some(Boolean);
}

async function jobPositionHasBlockingReferences(
  admin: AdminClient,
  jobPositionId: string
) {
  const checks = await Promise.all([
    tableHasRows(admin, "user_profiles", "job_position_id", jobPositionId),
    tableHasRows(admin, "shifts", "job_position_id", jobPositionId),
    tableHasRows(
      admin,
      "job_position_change_requests",
      "current_job_position_id",
      jobPositionId
    ),
    tableHasRows(
      admin,
      "job_position_change_requests",
      "requested_job_position_id",
      jobPositionId
    ),
  ]);

  return checks.some(Boolean);
}

async function ensureJobPositionInDepartment(input: {
  companyId: string;
  departmentId: string;
  jobPositionId: string;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("job_positions")
    .select("id")
    .eq("id", input.jobPositionId)
    .eq("company_id", input.companyId)
    .eq("department_id", input.departmentId)
    .eq("active", true)
    .maybeSingle();

  return !error && Boolean(data);
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

export async function updatePlatformCompanyThemeAction(formData: FormData) {
  const returnTo = getReturnPath(formData);
  const access = await requirePlatformAccess({ write: true }, returnTo);
  const companyId = getString(formData, "companyId");
  const rawAccentColor = getString(formData, "accentColor");
  const accentColor = rawAccentColor ? normalizeHexColor(rawAccentColor) : null;

  if (!isUuid(companyId) || (rawAccentColor && !accentColor)) {
    redirect(getPlatformFeedbackPath(returnTo, { error: "invalid-company-theme" }));
  }

  const admin = createAdminClient();
  const { data: company, error: companyError } = await admin
    .from("companies")
    .select("id, name, theme_config")
    .eq("id", companyId)
    .maybeSingle();

  if (companyError || !company) {
    redirect(getPlatformFeedbackPath(returnTo, { error: "company-not-found" }));
  }

  const typedCompany = company as {
    id: string;
    name: string;
    theme_config: Record<string, unknown> | null;
  };
  const themeConfig = buildCompanyThemeConfig(
    typedCompany.theme_config,
    accentColor
  );

  const { error } = await admin
    .from("companies")
    .update({ theme_config: themeConfig })
    .eq("id", companyId);

  if (error) {
    redirect(getPlatformFeedbackPath(returnTo, { error: "company-theme-save-failed" }));
  }

  await recordPlatformAuditEvent({
    action: "company.theme.update",
    actor: access.admin,
    companyId,
    metadata: {
      accentColor,
      companyName: typedCompany.name,
    },
    targetId: companyId,
    targetType: "company",
  });

  revalidatePath("/admin/platform");
  revalidatePath("/console");
  revalidatePath("/home", "layout");
  redirect(getPlatformFeedbackPath(returnTo, { status: "company-theme-updated" }));
}

export async function createPlatformDepartmentAction(formData: FormData) {
  const access = await requirePlatformAccess({ write: true });
  const companyId = getString(formData, "companyId");
  const parentDepartmentId = getString(formData, "parentDepartmentId");
  const name = getString(formData, "departmentName");
  const admin = createAdminClient();

  if (!isUuid(companyId) || !name || name.length > 120) {
    redirect(getConsolePath({ error: "invalid-department" }));
  }

  if (parentDepartmentId && !isUuid(parentDepartmentId)) {
    redirect(getConsolePath({ error: "invalid-department" }));
  }

  if (parentDepartmentId) {
    const parentDepartment = await getConsoleDepartment(admin, parentDepartmentId);

    if (
      !parentDepartment ||
      parentDepartment.company_id !== companyId ||
      parentDepartment.parent_department_id
    ) {
      redirect(getConsolePath({ error: "invalid-department-scope" }));
    }
  }

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

export async function updatePlatformDepartmentAction(formData: FormData) {
  const access = await requirePlatformAccess({ write: true });
  const departmentId = getString(formData, "departmentId");
  const parentDepartmentId = getString(formData, "parentDepartmentId");
  const name = getString(formData, "departmentName");

  if (!isUuid(departmentId) || !name || name.length > 120) {
    redirect(getConsolePath({ error: "invalid-department" }));
  }

  if (parentDepartmentId && !isUuid(parentDepartmentId)) {
    redirect(getConsolePath({ error: "invalid-department" }));
  }

  const admin = createAdminClient();
  const department = await getConsoleDepartment(admin, departmentId);

  if (!department) {
    redirect(getConsolePath({ error: "invalid-department" }));
  }

  if (parentDepartmentId === departmentId) {
    redirect(getConsolePath({ error: "invalid-department-scope" }));
  }

  let nextParentDepartmentId: string | null = null;
  let nextIsAssignable = false;

  if (parentDepartmentId) {
    const parentDepartment = await getConsoleDepartment(admin, parentDepartmentId);

    if (
      !parentDepartment ||
      parentDepartment.company_id !== department.company_id ||
      parentDepartment.parent_department_id
    ) {
      redirect(getConsolePath({ error: "invalid-department-scope" }));
    }

    if (
      !department.parent_department_id &&
      (await tableHasRows(admin, "departments", "parent_department_id", departmentId))
    ) {
      redirect(getConsolePath({ error: "department-update-blocked" }));
    }

    nextParentDepartmentId = parentDepartmentId;
    nextIsAssignable = true;
  } else if (
    department.is_assignable &&
    (await departmentHasOperationalReferences(admin, departmentId))
  ) {
    redirect(getConsolePath({ error: "department-update-blocked" }));
  }

  const { error } = await admin
    .from("departments")
    .update({
      is_assignable: nextIsAssignable,
      name,
      parent_department_id: nextParentDepartmentId,
    })
    .eq("id", departmentId);

  if (error) {
    redirect(getConsolePath({ error: "department-update-failed" }));
  }

  await recordPlatformAuditEvent({
    action: "department.update",
    actor: access.admin,
    companyId: department.company_id,
    metadata: {
      name,
      parentDepartmentId: nextParentDepartmentId,
      previousName: department.name,
      previousParentDepartmentId: department.parent_department_id,
    },
    targetId: departmentId,
    targetType: "department",
  });

  revalidatePath("/console");
  redirect(getConsolePath({ status: "department-updated" }));
}

export async function deletePlatformDepartmentAction(formData: FormData) {
  const access = await requirePlatformAccess({ write: true });
  const departmentId = getString(formData, "departmentId");

  if (!isUuid(departmentId)) {
    redirect(getConsolePath({ error: "invalid-department" }));
  }

  const admin = createAdminClient();
  const department = await getConsoleDepartment(admin, departmentId);

  if (!department) {
    redirect(getConsolePath({ error: "invalid-department" }));
  }

  if (await departmentHasBlockingReferences(admin, departmentId)) {
    redirect(getConsolePath({ error: "department-delete-blocked" }));
  }

  const { error } = await admin
    .from("departments")
    .delete()
    .eq("id", departmentId);

  if (error) {
    redirect(getConsolePath({ error: "department-delete-failed" }));
  }

  await recordPlatformAuditEvent({
    action: "department.delete",
    actor: access.admin,
    companyId: department.company_id,
    metadata: {
      name: department.name,
      parentDepartmentId: department.parent_department_id,
    },
    targetId: departmentId,
    targetType: "department",
  });

  revalidatePath("/console");
  redirect(getConsolePath({ status: "department-deleted" }));
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

export async function updatePlatformJobPositionAction(formData: FormData) {
  const access = await requirePlatformAccess({ write: true });
  const jobPositionId = getString(formData, "jobPositionId");
  const departmentId = getString(formData, "departmentId");
  const name = getString(formData, "jobPositionName");
  const code = getString(formData, "jobPositionCode");
  const active = getString(formData, "jobPositionActive") !== "false";

  if (
    !isUuid(jobPositionId) ||
    !isUuid(departmentId) ||
    !name ||
    name.length > 120 ||
    code.length > 64
  ) {
    redirect(getConsolePath({ error: "invalid-job-position" }));
  }

  const admin = createAdminClient();
  const jobPosition = await getConsoleJobPosition(admin, jobPositionId);

  if (!jobPosition) {
    redirect(getConsolePath({ error: "invalid-job-position" }));
  }

  if (
    !(await ensureDepartmentInCompany({
      companyId: jobPosition.company_id,
      departmentId,
      requireAssignable: true,
    }))
  ) {
    redirect(getConsolePath({ error: "invalid-department-scope" }));
  }

  const { error } = await admin
    .from("job_positions")
    .update({
      active,
      code: code || null,
      department_id: departmentId,
      name,
    })
    .eq("id", jobPositionId);

  if (error) {
    redirect(getConsolePath({ error: "job-position-update-failed" }));
  }

  await recordPlatformAuditEvent({
    action: "job_position.update",
    actor: access.admin,
    companyId: jobPosition.company_id,
    metadata: {
      active,
      code: code || null,
      departmentId,
      name,
      previousActive: jobPosition.active,
      previousCode: jobPosition.code,
      previousDepartmentId: jobPosition.department_id,
      previousName: jobPosition.name,
    },
    targetId: jobPositionId,
    targetType: "job_position",
  });

  revalidatePath("/console");
  redirect(getConsolePath({ status: "job-position-updated" }));
}

export async function deletePlatformJobPositionAction(formData: FormData) {
  const access = await requirePlatformAccess({ write: true });
  const jobPositionId = getString(formData, "jobPositionId");

  if (!isUuid(jobPositionId)) {
    redirect(getConsolePath({ error: "invalid-job-position" }));
  }

  const admin = createAdminClient();
  const jobPosition = await getConsoleJobPosition(admin, jobPositionId);

  if (!jobPosition) {
    redirect(getConsolePath({ error: "invalid-job-position" }));
  }

  if (await jobPositionHasBlockingReferences(admin, jobPositionId)) {
    redirect(getConsolePath({ error: "job-position-delete-blocked" }));
  }

  const { error } = await admin
    .from("job_positions")
    .delete()
    .eq("id", jobPositionId);

  if (error) {
    redirect(getConsolePath({ error: "job-position-delete-failed" }));
  }

  await recordPlatformAuditEvent({
    action: "job_position.delete",
    actor: access.admin,
    companyId: jobPosition.company_id,
    metadata: {
      code: jobPosition.code,
      departmentId: jobPosition.department_id,
      name: jobPosition.name,
    },
    targetId: jobPositionId,
    targetType: "job_position",
  });

  revalidatePath("/console");
  redirect(getConsolePath({ status: "job-position-deleted" }));
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
    .select("id, company_id, parent_department_id")
    .eq("id", departmentId)
    .maybeSingle();

  if (
    !department ||
    (department as { parent_department_id: string | null }).parent_department_id
  ) {
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

export async function deletePlatformScheduleConfigAction(formData: FormData) {
  const access = await requirePlatformAccess({ write: true });
  const departmentId = getString(formData, "departmentId");

  if (!isUuid(departmentId)) {
    redirect(getConsolePath({ error: "invalid-schedule-config" }));
  }

  const admin = createAdminClient();
  const department = await getConsoleDepartment(admin, departmentId);

  if (!department || department.parent_department_id) {
    redirect(getConsolePath({ error: "invalid-schedule-config" }));
  }

  const { error } = await admin
    .from("area_schedule_configs")
    .delete()
    .eq("department_id", departmentId);

  if (error) {
    redirect(getConsolePath({ error: "schedule-config-delete-failed" }));
  }

  await recordPlatformAuditEvent({
    action: "schedule_config.delete",
    actor: access.admin,
    companyId: department.company_id,
    metadata: { departmentName: department.name },
    targetId: departmentId,
    targetType: "department",
  });

  revalidatePath("/console");
  redirect(getConsolePath({ status: "schedule-config-deleted" }));
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

  if (
    jobPositionId &&
    !(await ensureJobPositionInDepartment({
      companyId,
      departmentId,
      jobPositionId,
    }))
  ) {
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
