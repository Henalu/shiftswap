import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripePortalSession, stripeReady } from "@/lib/stripe";
import { getAppUrl } from "@/lib/app-config";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!stripeReady()) {
    return NextResponse.redirect(new URL("/billing?stripe=missing", request.url));
  }

  const admin = createAdminClient();
  const { data: account } = await admin
    .from("billing_accounts")
    .select("provider_customer_id")
    .eq("owner_type", "user")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!account?.provider_customer_id) {
    return NextResponse.redirect(new URL("/billing?portal=unavailable", request.url));
  }

  const session = await createStripePortalSession({
    customerId: account.provider_customer_id,
    returnUrl: `${getAppUrl()}/billing`,
  });

  return NextResponse.redirect(session.url);
}
