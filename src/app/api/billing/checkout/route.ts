import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getAppUrl,
  getBillingMode,
  isBillingEnabled,
} from "@/lib/app-config";
import {
  assignBillingPlanForCheckout,
  ensureBillingAccountForUser,
} from "@/lib/billing";
import {
  createStripeCheckoutSession,
  createStripeCustomer,
  resolveStripePriceId,
  stripeReady,
} from "@/lib/stripe";
import { getAccountGateState } from "@/lib/user-profiles";

export async function POST(request: Request) {
  const formData = await request.formData();
  const billingInterval =
    formData.get("billing_interval") === "year" ? "year" : "month";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!isBillingEnabled()) {
    return NextResponse.redirect(new URL("/billing", request.url));
  }

  if (getBillingMode() !== "user") {
    return NextResponse.redirect(new URL("/billing?mode=company", request.url));
  }

  if (!stripeReady()) {
    return NextResponse.redirect(new URL("/billing?stripe=missing", request.url));
  }

  const accountState = await getAccountGateState(user.id);

  if (!accountState || accountState.validation_status !== "approved") {
    return NextResponse.redirect(new URL("/pending-validation", request.url));
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("email, full_name")
    .eq("id", user.id)
    .single();

  const billingAccount = await ensureBillingAccountForUser({
    userId: user.id,
    email: profile?.email ?? user.email ?? "",
  });
  const planAssignment = await assignBillingPlanForCheckout({
    billingAccountId: billingAccount.id,
    billingInterval,
  });
  const priceId = resolveStripePriceId({
    stripe_price_id: planAssignment.stripePriceId,
    stripe_price_env_var: planAssignment.stripePriceEnvVar,
  });

  if (!priceId) {
    return NextResponse.redirect(
      new URL(`/billing?price=missing&interval=${billingInterval}`, request.url)
    );
  }

  let customerId = billingAccount.provider_customer_id;

  if (!customerId) {
    const customer = await createStripeCustomer({
      email: profile?.email ?? user.email ?? "",
      fullName: profile?.full_name ?? user.user_metadata?.full_name ?? "",
      metadata: {
        billing_account_id: billingAccount.id,
        owner_type: "user",
        owner_user_id: user.id,
      },
    });

    customerId = customer.id;

    await admin
      .from("billing_accounts")
      .update({
        provider_customer_id: customer.id,
        billing_email: profile?.email ?? user.email ?? null,
      })
      .eq("id", billingAccount.id);
  }

  const appUrl = getAppUrl();
  const session = await createStripeCheckoutSession({
    customerId,
    priceId,
    successUrl: `${appUrl}/billing?checkout=success`,
    cancelUrl: `${appUrl}/billing?checkout=cancelled`,
    clientReferenceId: billingAccount.id,
    trialDays: planAssignment.trialDays,
    metadata: {
      billing_account_id: billingAccount.id,
      billing_plan_id: planAssignment.billingPlanId,
      plan_code: planAssignment.planCode,
      pricing_cohort_code: planAssignment.pricingCohortCode,
      early_access_position: String(planAssignment.earlyAccessPosition),
      billing_interval: billingInterval,
      owner_type: "user",
      owner_user_id: user.id,
    },
  });

  if (!session.url) {
    return NextResponse.redirect(new URL("/billing?checkout=failed", request.url));
  }

  return NextResponse.redirect(session.url);
}
