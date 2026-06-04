import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const PLATFORM_ROLES = ["platform_owner", "support", "viewer"] as const;
export const PLATFORM_ADMIN_STATUSES = [
  "active",
  "inactive",
  "suspended",
] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];
export type PlatformAdminStatus = (typeof PLATFORM_ADMIN_STATUSES)[number];

export interface PlatformAdmin {
  id: string;
  user_id: string;
  role: PlatformRole;
  status: PlatformAdminStatus;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export type PlatformConsoleAccess =
  | {
      admin: PlatformAdmin;
      ok: true;
      userId: string;
    }
  | {
      error: "authentication-required" | "forbidden";
      ok: false;
    };

export const PLATFORM_ROLE_LABELS: Record<PlatformRole, string> = {
  platform_owner: "Platform owner",
  support: "Soporte plataforma",
  viewer: "Lectura plataforma",
};

export function isPlatformRole(value: string): value is PlatformRole {
  return PLATFORM_ROLES.includes(value as PlatformRole);
}

export function canManagePlatform(admin: PlatformAdmin | null | undefined) {
  return admin?.role === "platform_owner";
}

export function canOperatePlatformUsers(admin: PlatformAdmin | null | undefined) {
  return admin?.role === "platform_owner" || admin?.role === "support";
}

export async function getActivePlatformAdminForUser(
  userId: string
): Promise<PlatformAdmin | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_admins")
    .select("id, user_id, role, status, display_name, created_at, updated_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("[platform-console] Failed to load platform admin", {
      message: error.message,
      userId,
    });
    return null;
  }

  const row = data as PlatformAdmin | null;
  return row && isPlatformRole(row.role) ? row : null;
}

export async function getCurrentPlatformAccess(): Promise<PlatformConsoleAccess> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "authentication-required", ok: false };
  }

  const admin = await getActivePlatformAdminForUser(user.id);

  if (!admin) {
    return { error: "forbidden", ok: false };
  }

  return { admin, ok: true, userId: user.id };
}

export async function recordPlatformAuditEvent(input: {
  action: string;
  actor: PlatformAdmin;
  companyId?: string | null;
  metadata?: Record<string, unknown>;
  targetId?: string | null;
  targetType: string;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("platform_audit_events").insert({
    action: input.action,
    actor_platform_admin_id: input.actor.id,
    actor_user_id: input.actor.user_id,
    company_id: input.companyId ?? null,
    metadata: input.metadata ?? {},
    target_id: input.targetId ?? null,
    target_type: input.targetType,
  });

  if (error) {
    console.error("[platform-console] Failed to record audit event", {
      action: input.action,
      message: error.message,
    });
  }
}
