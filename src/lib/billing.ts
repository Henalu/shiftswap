import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getBillingEnforcement,
  getBillingMode,
  isBillingEnabled,
} from "@/lib/app-config";
import type {
  BillingAccessState,
  BillingEnforcementMode,
  BillingOwnerType,
  BillingSubscriptionStatus,
} from "@/types";
import {
  getAccountGateState,
  type AccountGateState,
} from "@/lib/user-profiles";

interface BillingAccountRow {
  id: string;
  owner_type: BillingOwnerType;
  provider_customer_id: string | null;
  billing_email: string | null;
  current_billing_state: BillingAccessState;
  trial_ends_at: string | null;
}

interface BillingSubscriptionRow {
  id: string;
  billing_plan_id: string | null;
  provider_subscription_id: string;
  provider_price_id: string | null;
  status: BillingSubscriptionStatus;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  billing_plan:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
}

export interface ResolvedBillingGateState {
  enabled: boolean;
  mode: BillingOwnerType;
  enforcement: BillingEnforcementMode;
  state: BillingAccessState;
  accessBlocked: boolean;
  reason: string | null;
  accountId: string | null;
  providerCustomerId: string | null;
  planName: string | null;
  subscriptionStatus: BillingSubscriptionStatus | null;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
}

const BILLING_BLOCKED_MESSAGE =
  "Tu acceso operativo esta bloqueado hasta que actives o regularices la suscripcion.";

function pickRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapSubscriptionStatusToAccessState(
  status: BillingSubscriptionStatus | null | undefined
): BillingAccessState {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "incomplete":
    case "incomplete_expired":
    case "canceled":
    default:
      return "blocked";
  }
}

function shouldBlockBillingState(
  enabled: boolean,
  enforcement: BillingEnforcementMode,
  state: BillingAccessState
) {
  return enabled && enforcement !== "off" && state === "blocked";
}

async function getBillingAccount(
  mode: BillingOwnerType,
  userId: string,
  companyId: string | null
) {
  const supabase = createAdminClient();
  let query = supabase
    .from("billing_accounts")
    .select(
      "id, owner_type, provider_customer_id, billing_email, current_billing_state, trial_ends_at"
    )
    .eq("owner_type", mode);

  if (mode === "company") {
    if (!companyId) {
      return null;
    }

    query = query.eq("owner_company_id", companyId);
  } else {
    query = query.eq("owner_user_id", userId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("[billing] Failed to load billing account", {
      userId,
      mode,
      message: error.message,
    });
    return null;
  }

  return (data as BillingAccountRow | null) ?? null;
}

async function getLatestBillingSubscription(accountId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("billing_subscriptions")
    .select(
      "id, billing_plan_id, provider_subscription_id, provider_price_id, status, current_period_end, trial_end, cancel_at_period_end, billing_plan:billing_plans(name)"
    )
    .eq("billing_account_id", accountId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[billing] Failed to load billing subscription", {
      accountId,
      message: error.message,
    });
    return null;
  }

  return (data as BillingSubscriptionRow | null) ?? null;
}

export async function ensureBillingAccountForUser(input: {
  userId: string;
  email: string;
}) {
  const supabase = createAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("billing_accounts")
    .select(
      "id, owner_type, provider_customer_id, billing_email, current_billing_state, trial_ends_at"
    )
    .eq("owner_type", "user")
    .eq("owner_user_id", input.userId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    if (!existing.billing_email || existing.billing_email !== input.email) {
      await supabase
        .from("billing_accounts")
        .update({
          billing_email: input.email,
        })
        .eq("id", existing.id);
    }

    return existing as BillingAccountRow;
  }

  const { data, error } = await supabase
    .from("billing_accounts")
    .insert({
      owner_type: "user",
      owner_user_id: input.userId,
      provider: "stripe",
      billing_email: input.email,
      current_billing_state: "inactive",
    })
    .select(
      "id, owner_type, provider_customer_id, billing_email, current_billing_state, trial_ends_at"
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as BillingAccountRow;
}

export async function resolveBillingGateState(
  userId: string,
  accountState?: AccountGateState | null
): Promise<ResolvedBillingGateState> {
  const enabled = isBillingEnabled();
  const mode = getBillingMode();
  const enforcement = getBillingEnforcement();
  const fallback: ResolvedBillingGateState = {
    enabled,
    mode,
    enforcement,
    state: "inactive",
    accessBlocked: false,
    reason: null,
    accountId: null,
    providerCustomerId: null,
    planName: null,
    subscriptionStatus: null,
    currentPeriodEnd: null,
    trialEnd: null,
  };

  if (!enabled) {
    return fallback;
  }

  const gateState = accountState ?? (await getAccountGateState(userId));

  if (mode === "company" && !gateState?.company_id) {
    return {
      ...fallback,
      state: "blocked",
      accessBlocked: shouldBlockBillingState(enabled, enforcement, "blocked"),
      reason:
        "No se ha podido resolver la empresa de facturacion para tu cuenta.",
    };
  }

  const account = await getBillingAccount(mode, userId, gateState?.company_id ?? null);

  if (!account) {
    const state = enforcement === "off" ? "inactive" : "blocked";
    return {
      ...fallback,
      state,
      accessBlocked: shouldBlockBillingState(enabled, enforcement, state),
      reason: state === "blocked" ? BILLING_BLOCKED_MESSAGE : null,
    };
  }

  const subscription = await getLatestBillingSubscription(account.id);
  const plan = pickRelation(subscription?.billing_plan);
  const state = subscription
    ? mapSubscriptionStatusToAccessState(subscription.status)
    : enforcement === "off"
      ? account.current_billing_state
      : "blocked";

  return {
    enabled,
    mode,
    enforcement,
    state,
    accessBlocked: shouldBlockBillingState(enabled, enforcement, state),
    reason:
      state === "blocked"
        ? BILLING_BLOCKED_MESSAGE
        : state === "past_due"
          ? "Tu suscripcion necesita regularizacion, pero el acceso sigue temporalmente abierto."
          : null,
    accountId: account.id,
    providerCustomerId: account.provider_customer_id,
    planName: plan?.name ?? null,
    subscriptionStatus: subscription?.status ?? null,
    currentPeriodEnd: subscription?.current_period_end ?? null,
    trialEnd: subscription?.trial_end ?? account.trial_ends_at ?? null,
  };
}

export async function syncBillingAccountState(input: {
  accountId: string;
  subscriptionStatus: BillingSubscriptionStatus | null;
  trialEnd?: string | null;
}) {
  const supabase = createAdminClient();
  const nextState = input.subscriptionStatus
    ? mapSubscriptionStatusToAccessState(input.subscriptionStatus)
    : "blocked";

  const { error } = await supabase
    .from("billing_accounts")
    .update({
      current_billing_state: nextState,
      trial_ends_at: input.trialEnd ?? null,
    })
    .eq("id", input.accountId);

  if (error) {
    console.error("[billing] Failed to sync account state", {
      accountId: input.accountId,
      message: error.message,
    });
  }
}
