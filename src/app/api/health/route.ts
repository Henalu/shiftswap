import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isBillingEnabled, isStripeConfigured } from "@/lib/app-config";

export async function GET() {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("companies")
    .select("id", { head: true, count: "exact" })
    .limit(1);

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        database: "down",
        billing_enabled: isBillingEnabled(),
        stripe_ready: isStripeConfigured(),
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    database: "up",
    billing_enabled: isBillingEnabled(),
    stripe_ready: isStripeConfigured(),
    timestamp: new Date().toISOString(),
  });
}
