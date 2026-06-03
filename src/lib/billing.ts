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
  BillingInterval,
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
  billing_plan_id: string | null;
  pricing_cohort_code: string | null;
  billing_interval: BillingInterval | null;
  early_access_position: number | null;
  provider_customer_id: string | null;
  billing_email: string | null;
  current_billing_state: BillingAccessState;
  trial_ends_at: string | null;
  price_lock_ends_at: string | null;
  billing_plan:
    | {
        code: string;
        name: string;
        amount_cents: number;
        currency: string;
        billing_interval: BillingInterval;
        cohort_code: string | null;
      }
    | {
        code: string;
        name: string;
        amount_cents: number;
        currency: string;
        billing_interval: BillingInterval;
        cohort_code: string | null;
      }[]
    | null;
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
        code: string;
        name: string;
        amount_cents: number;
        currency: string;
        billing_interval: BillingInterval;
        cohort_code: string | null;
      }
    | {
        code: string;
        name: string;
        amount_cents: number;
        currency: string;
        billing_interval: BillingInterval;
        cohort_code: string | null;
      }[]
    | null;
}

interface BillingPlanRow {
  id: string;
  code: string;
  owner_type: BillingOwnerType;
  name: string;
  description: string | null;
  billing_interval: BillingInterval;
  currency: string;
  amount_cents: number;
  active: boolean;
  stripe_price_id: string | null;
  cohort_code: string | null;
  price_label: string | null;
  stripe_price_env_var: string | null;
  marketing_badge: string | null;
  trial_days: number;
  price_lock_months: number;
  is_public: boolean;
  sort_order: number;
}

interface BillingPricingCohortRow {
  code: string;
  label: string;
  description: string | null;
  min_position: number;
  max_position: number | null;
  trial_days: number;
  price_lock_months: number;
  discount_label: string;
  active: boolean;
}

interface BillingPlanAssignmentRow {
  billing_account_id: string;
  billing_plan_id: string;
  plan_code: string;
  stripe_price_id: string | null;
  stripe_price_env_var: string | null;
  pricing_cohort_code: string;
  early_access_position: number;
  trial_days: number;
  price_lock_ends_at: string | null;
}

export interface PublicBillingPlanOption extends BillingPlanRow {
  cohort: BillingPricingCohortRow | null;
}

export interface BillingCheckoutPlanAssignment {
  billingAccountId: string;
  billingPlanId: string;
  planCode: string;
  stripePriceId: string | null;
  stripePriceEnvVar: string | null;
  pricingCohortCode: string;
  earlyAccessPosition: number;
  trialDays: number;
  priceLockEndsAt: string | null;
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
  planCode: string | null;
  planName: string | null;
  billingInterval: BillingInterval | null;
  amountCents: number | null;
  currency: string | null;
  pricingCohortCode: string | null;
  earlyAccessPosition: number | null;
  priceLockEndsAt: string | null;
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
      return "past_due";
    case "unpaid":
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
  return enabled && enforcement === "hard" && state === "blocked";
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
      "id, owner_type, billing_plan_id, pricing_cohort_code, billing_interval, early_access_position, provider_customer_id, billing_email, current_billing_state, trial_ends_at, price_lock_ends_at, billing_plan:billing_plans(code, name, amount_cents, currency, billing_interval, cohort_code)"
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
      "id, billing_plan_id, provider_subscription_id, provider_price_id, status, current_period_end, trial_end, cancel_at_period_end, billing_plan:billing_plans(code, name, amount_cents, currency, billing_interval, cohort_code)"
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
      "id, owner_type, billing_plan_id, pricing_cohort_code, billing_interval, early_access_position, provider_customer_id, billing_email, current_billing_state, trial_ends_at, price_lock_ends_at, billing_plan:billing_plans(code, name, amount_cents, currency, billing_interval, cohort_code)"
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
      "id, owner_type, billing_plan_id, pricing_cohort_code, billing_interval, early_access_position, provider_customer_id, billing_email, current_billing_state, trial_ends_at, price_lock_ends_at, billing_plan:billing_plans(code, name, amount_cents, currency, billing_interval, cohort_code)"
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as BillingAccountRow;
}

export async function getPublicBillingPlans(): Promise<PublicBillingPlanOption[]> {
  const supabase = createAdminClient();
  const [{ data: plans, error: plansError }, { data: cohorts, error: cohortsError }] =
    await Promise.all([
      supabase
        .from("billing_plans")
        .select(
          "id, code, owner_type, name, description, billing_interval, currency, amount_cents, active, stripe_price_id, cohort_code, price_label, stripe_price_env_var, marketing_badge, trial_days, price_lock_months, is_public, sort_order"
        )
        .eq("owner_type", "user")
        .eq("active", true)
        .eq("is_public", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("billing_pricing_cohorts")
        .select(
          "code, label, description, min_position, max_position, trial_days, price_lock_months, discount_label, active"
        )
        .eq("active", true)
        .order("min_position", { ascending: true }),
    ]);

  if (plansError) {
    throw new Error(plansError.message);
  }

  if (cohortsError) {
    throw new Error(cohortsError.message);
  }

  const cohortMap = new Map(
    ((cohorts ?? []) as BillingPricingCohortRow[]).map((cohort) => [
      cohort.code,
      cohort,
    ])
  );

  return ((plans ?? []) as BillingPlanRow[]).map((plan) => ({
    ...plan,
    cohort: plan.cohort_code ? cohortMap.get(plan.cohort_code) ?? null : null,
  }));
}

export async function assignBillingPlanForCheckout(input: {
  billingAccountId: string;
  billingInterval: "month" | "year";
}): Promise<BillingCheckoutPlanAssignment> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("assign_billing_plan_for_checkout", {
    target_billing_account_id: input.billingAccountId,
    requested_interval: input.billingInterval,
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data)
    ? ((data[0] as BillingPlanAssignmentRow | undefined) ?? null)
    : ((data as BillingPlanAssignmentRow | null) ?? null);

  if (!row) {
    throw new Error("No se ha podido asignar un plan comercial.");
  }

  return {
    billingAccountId: row.billing_account_id,
    billingPlanId: row.billing_plan_id,
    planCode: row.plan_code,
    stripePriceId: row.stripe_price_id,
    stripePriceEnvVar: row.stripe_price_env_var,
    pricingCohortCode: row.pricing_cohort_code,
    earlyAccessPosition: row.early_access_position,
    trialDays: row.trial_days,
    priceLockEndsAt: row.price_lock_ends_at,
  };
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
    planCode: null,
    planName: null,
    billingInterval: null,
    amountCents: null,
    currency: null,
    pricingCohortCode: null,
    earlyAccessPosition: null,
    priceLockEndsAt: null,
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
  const accountPlan = pickRelation(account.billing_plan);
  const effectivePlan = plan ?? accountPlan;
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
    planCode: effectivePlan?.code ?? null,
    planName: effectivePlan?.name ?? null,
    billingInterval: effectivePlan?.billing_interval ?? account.billing_interval ?? null,
    amountCents: effectivePlan?.amount_cents ?? null,
    currency: effectivePlan?.currency ?? null,
    pricingCohortCode:
      effectivePlan?.cohort_code ?? account.pricing_cohort_code ?? null,
    earlyAccessPosition: account.early_access_position,
    priceLockEndsAt: account.price_lock_ends_at,
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
