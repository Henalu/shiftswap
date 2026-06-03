import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { readEnv } from "./helpers/env";

const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
const e2eBaseUrl = readEnv("E2E_BASE_URL");
const isRemoteSmoke = Boolean(
  e2eBaseUrl && !/^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])/i.test(e2eBaseUrl)
);
const isLocalSupabase = Boolean(
  supabaseUrl &&
    /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])/i.test(supabaseUrl)
);

const expectedB2cPlans = [
  { code: "founder_20_monthly", amount_cents: 149, billing_interval: "month" },
  { code: "founder_20_annual", amount_cents: 1499, billing_interval: "year" },
  { code: "early_70_monthly", amount_cents: 199, billing_interval: "month" },
  { code: "early_70_annual", amount_cents: 1999, billing_interval: "year" },
  { code: "growth_170_monthly", amount_cents: 239, billing_interval: "month" },
  { code: "growth_170_annual", amount_cents: 2399, billing_interval: "year" },
  { code: "launch_200_monthly", amount_cents: 269, billing_interval: "month" },
  { code: "launch_200_annual", amount_cents: 2699, billing_interval: "year" },
  { code: "standard_monthly", amount_cents: 299, billing_interval: "month" },
  { code: "standard_annual", amount_cents: 2999, billing_interval: "year" },
] as const;

test.describe("billing pricing smoke", () => {
  test.skip(
    !supabaseUrl || !serviceRoleKey,
    "Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para validar el catalogo de billing."
  );
  test.skip(
    isRemoteSmoke && isLocalSupabase,
    "Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY del entorno remoto para validar billing contra staging."
  );

  test("public billing catalog exposes only B2C launch plans", async () => {
    const supabase = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: publicPlans, error } = await supabase
      .from("billing_plans")
      .select(
        "code, owner_type, billing_interval, amount_cents, active, is_public"
      )
      .eq("is_public", true)
      .order("sort_order", { ascending: true });

    expect(error).toBeNull();
    expect(publicPlans).toHaveLength(expectedB2cPlans.length);

    const plansByCode = new Map(
      (publicPlans ?? []).map((plan) => [String(plan.code), plan])
    );

    for (const expectedPlan of expectedB2cPlans) {
      const plan = plansByCode.get(expectedPlan.code);

      expect(plan, `${expectedPlan.code} exists`).toBeTruthy();
      expect(plan?.owner_type).toBe("user");
      expect(plan?.active).toBe(true);
      expect(plan?.is_public).toBe(true);
      expect(plan?.billing_interval).toBe(expectedPlan.billing_interval);
      expect(plan?.amount_cents).toBe(expectedPlan.amount_cents);
    }

    const publicCompanyPlans = (publicPlans ?? []).filter(
      (plan) => plan.owner_type === "company"
    );

    expect(publicCompanyPlans).toHaveLength(0);
  });
});
