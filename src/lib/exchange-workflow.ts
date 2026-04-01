import { createAdminClient } from "@/lib/supabase/admin";
import { getAccountGateState } from "@/lib/user-profiles";
import {
  canAccessScopedDepartment,
  hasAdminPanelAccess,
  type ScopedRoleUser,
} from "@/lib/user-roles";
import type {
  ExchangeEventType,
  ExchangeStatus,
  UserRole,
  ValidationStatus,
} from "@/types";

export const ACTIVE_EXCHANGE_STATUSES: readonly ExchangeStatus[] = [
  "accepted",
  "pending_validation",
  "approved",
  "completed",
];

export const EXCHANGE_HISTORY_STATUSES: readonly ExchangeStatus[] = [
  "approved",
  "rejected",
  "completed",
  "cancelled",
  "expired",
];

export const EXCHANGE_CAN_CHAT_STATUSES: readonly ExchangeStatus[] = [
  "accepted",
  "pending_validation",
  "approved",
];

export const EXCHANGE_SUPPORTING_DOCUMENT_STATUSES: readonly ExchangeStatus[] = [
  "accepted",
  "pending_validation",
  "approved",
  "rejected",
];

export const EXCHANGE_EXPORTABLE_STATUSES: readonly ExchangeStatus[] = [
  "accepted",
  "pending_validation",
  "approved",
  "rejected",
  "completed",
];

export interface AuthenticatedExchangeActor extends ScopedRoleUser {
  id: string;
  validation_status: ValidationStatus;
}

export interface ExchangeAccessScope {
  user_a_id: string;
  user_b_id: string;
  company_id: string | null;
  department_id: string | null;
}

interface ApproverProfileRow {
  id: string;
  role: UserRole;
  company_id: string | null;
  department_id: string | null;
  validation_status: ValidationStatus;
}

interface RecordExchangeEventInput {
  exchangeId: string;
  actorId?: string | null;
  eventType: ExchangeEventType;
  title: string;
  details?: string | null;
  fromStatus?: ExchangeStatus | null;
  toStatus?: ExchangeStatus | null;
  metadata?: Record<string, unknown>;
}

export async function getAuthenticatedExchangeActor(
  userId: string
): Promise<AuthenticatedExchangeActor | null> {
  const accountState = await getAccountGateState(userId);

  if (!accountState) {
    return null;
  }

  return {
    id: userId,
    role: accountState.role,
    company_id: accountState.company_id,
    department_id: accountState.department_id,
    validation_status: accountState.validation_status,
  };
}

export function isExchangeParticipant(
  actorId: string | null | undefined,
  exchange: Pick<ExchangeAccessScope, "user_a_id" | "user_b_id">
): boolean {
  if (!actorId) return false;
  return exchange.user_a_id === actorId || exchange.user_b_id === actorId;
}

export function canAccessExchange(
  actor: AuthenticatedExchangeActor | null | undefined,
  exchange: ExchangeAccessScope
): boolean {
  if (!actor) return false;

  if (isExchangeParticipant(actor.id, exchange)) {
    return true;
  }

  return (
    hasAdminPanelAccess(actor.role) && canAccessScopedDepartment(actor, exchange)
  );
}

export function canReviewExchange(
  actor: AuthenticatedExchangeActor | null | undefined,
  exchange: ExchangeAccessScope
): boolean {
  if (!actor || !hasAdminPanelAccess(actor.role)) {
    return false;
  }

  return canAccessScopedDepartment(actor, exchange);
}

export async function getScopedExchangeApproverIds(
  scope: Pick<ExchangeAccessScope, "company_id" | "department_id">
): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, role, company_id, department_id, validation_status")
    .eq("validation_status", "approved")
    .in("role", ["department_admin", "hr_admin", "super_admin"]);

  if (error) {
    console.error("[exchange-workflow] Failed to load approvers", error.message);
    return [];
  }

  const approvers = (data ?? []) as ApproverProfileRow[];
  const scopedIds = approvers
    .filter((approver) =>
      canAccessScopedDepartment(
        approver as ScopedRoleUser,
        scope
      )
    )
    .map((approver) => approver.id);

  return [...new Set(scopedIds)];
}

export async function recordExchangeEvent({
  exchangeId,
  actorId = null,
  eventType,
  title,
  details = null,
  fromStatus = null,
  toStatus = null,
  metadata = {},
}: RecordExchangeEventInput): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("exchange_events").insert({
    exchange_id: exchangeId,
    actor_id: actorId,
    event_type: eventType,
    title,
    details,
    from_status: fromStatus,
    to_status: toStatus,
    metadata,
  });

  if (error) {
    console.error("[exchange-workflow] Failed to record event", {
      exchangeId,
      eventType,
      message: error.message,
    });
  }
}
