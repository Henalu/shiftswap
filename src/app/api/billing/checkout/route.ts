import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getAppUrl,
  getBillingMode,
  isBillingEnabled,
} from "@/lib/app-config";
import { ensureBillingAccountForUser } from "@/lib/billing";
import {
  createStripeCheckoutSession,
  createStripeCustomer,
  stripeReady,
} from "@/lib/stripe";
import { getAccountGateState } from "@/lib/user-profiles";

export async function POST(request: Request) {
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
    successUrl: `${appUrl}/billing?checkout=success`,
    cancelUrl: `${appUrl}/billing?checkout=cancelled`,
    metadata: {
      billing_account_id: billingAccount.id,
      owner_type: "user",
      owner_user_id: user.id,
    },
  });

  if (!session.url) {
    return NextResponse.redirect(new URL("/billing?checkout=failed", request.url));
  }

  return NextResponse.redirect(session.url);
}
