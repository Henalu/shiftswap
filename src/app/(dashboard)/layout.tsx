import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { GuidedHelpTour } from "@/components/layout/guided-help-tour";
import { Header } from "@/components/layout/header";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { OnboardingModal } from "@/components/layout/onboarding-modal";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { AlertTriangle } from "lucide-react";
import { resolveBillingGateState } from "@/lib/billing";
import {
  getCompanyThemeCssVariables,
  type CompanyThemeCssVariables,
} from "@/lib/company-theme";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getAccountGateState,
  USER_PROFILE_PUBLIC_SELECT,
} from "@/lib/user-profiles";
import { getActivePlatformAdminForUser } from "@/lib/platform-console";
import type { Notification } from "@/types";

export const dynamic = "force-dynamic";

type CompanyThemeStyle = CSSProperties & CompanyThemeCssVariables;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const adminClient = createAdminClient();

  const [accountState, platformAdmin, { data: profile }, { data: notifications }, unreadResult, { data: onboardingRow }] =
    await Promise.all([
      getAccountGateState(authUser.id),
      getActivePlatformAdminForUser(authUser.id),
      supabase
        .from("user_profiles")
        .select(USER_PROFILE_PUBLIC_SELECT)
        .eq("id", authUser.id)
        .single(),
      supabase
        .from("notifications")
        .select("*")
        .eq("user_id", authUser.id)
        .or("resolved_at.is.null,read.eq.false")
        .order("updated_at", { ascending: false })
        .limit(12),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", authUser.id)
        .eq("read", false)
        .is("resolved_at", null),
      adminClient
        .from("user_profiles")
        .select("onboarding_completed_at")
        .eq("id", authUser.id)
        .maybeSingle(),
    ]);

  if (
    accountState?.role !== "super_admin" &&
    (accountState?.validation_status === "pending" ||
      accountState?.validation_status === "rejected")
  ) {
    redirect("/pending-validation");
  }

  const billingState = await resolveBillingGateState(authUser.id, accountState);

  if (billingState.accessBlocked) {
    redirect("/billing");
  }

  const typedNotifications = (notifications ?? []) as Notification[];
  const unreadCount = unreadResult.count ?? 0;
  const role = accountState?.role ?? "member";
  const showOnboarding = !(onboardingRow as { onboarding_completed_at: string | null } | null)?.onboarding_completed_at;

  let companyName: string | undefined;
  let companyThemeStyle: CompanyThemeStyle | undefined;

  if (accountState?.company_id) {
    const { data: company } = await supabase
      .from("companies")
      .select("name, theme_config")
      .eq("id", accountState.company_id)
      .maybeSingle();
    const typedCompany = company as {
      name?: string;
      theme_config?: Record<string, unknown> | null;
    } | null;
    companyName = typedCompany?.name ?? undefined;
    companyThemeStyle = getCompanyThemeCssVariables(
      typedCompany?.theme_config
    ) as CompanyThemeStyle | undefined;
  }

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden"
      data-company-theme={companyThemeStyle ? "custom" : "default"}
      style={companyThemeStyle}
    >
      <Header
        user={profile}
        companyName={companyName}
        initialNotifications={typedNotifications}
        initialUnreadCount={unreadCount}
        canAccessPlatformConsole={Boolean(platformAdmin)}
        role={role}
      />
      <div className="mx-auto flex min-h-0 min-w-0 w-full max-w-7xl flex-1 overflow-x-hidden pt-[calc(env(safe-area-inset-top)+3.5rem)] md:pt-0">
        <aside className="hidden h-full w-72 shrink-0 overflow-hidden border-r border-border/70 bg-sidebar/75 md:block">
          <SidebarNav role={role} />
        </aside>
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          <div className="flex min-h-full min-w-0 max-w-full flex-col gap-8 px-4 py-6 pb-[calc(env(safe-area-inset-bottom)+7rem)] sm:px-6 md:pb-6 lg:px-8">
            {billingState.enabled && billingState.state === "past_due" ? (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">
                      Tu suscripcion necesita regularizacion
                    </p>
                    <p className="text-amber-800/90">
                      El acceso sigue abierto de forma temporal, pero debes revisar el pago cuanto antes desde{" "}
                      <a
                        href="/billing"
                        className="font-medium underline underline-offset-4"
                      >
                        Suscripcion
                      </a>
                      .
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
            {children}
          </div>
        </main>
      </div>
      <MobileBottomNav />
      {showOnboarding && <OnboardingModal />}
      <GuidedHelpTour autoStart={!showOnboarding} role={role} />
    </div>
  );
}
