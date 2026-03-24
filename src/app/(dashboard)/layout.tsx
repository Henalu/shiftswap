import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { createClient } from "@/lib/supabase/server";
import {
  getAccountGateState,
  USER_PROFILE_PUBLIC_SELECT,
} from "@/lib/user-profiles";
import type { Notification } from "@/types";

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

  const [accountState, { data: profile }, { data: notifications }, unreadResult] =
    await Promise.all([
      getAccountGateState(authUser.id),
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
    ]);

  if (
    accountState?.validation_status === "pending" ||
    accountState?.validation_status === "rejected"
  ) {
    redirect("/pending-validation");
  }

  const typedNotifications = (notifications ?? []) as Notification[];
  const unreadCount = unreadResult.count ?? 0;
  const role = accountState?.role ?? "member";

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        user={profile}
        initialNotifications={typedNotifications}
        initialUnreadCount={unreadCount}
        role={role}
      />
      <div className="mx-auto flex w-full max-w-7xl flex-1">
        <aside className="hidden w-72 shrink-0 border-r border-border/70 bg-sidebar/75 md:block">
          <SidebarNav role={role} />
        </aside>
        <main className="min-w-0 flex-1 overflow-auto">
          <div className="flex min-h-full flex-col gap-8 px-4 py-6 pb-[calc(env(safe-area-inset-bottom)+7rem)] sm:px-6 md:pb-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
