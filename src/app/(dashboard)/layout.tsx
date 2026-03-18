import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import type { Notification } from "@/types";
import {
  getAccountGateState,
  USER_PROFILE_PUBLIC_SELECT,
} from "@/lib/user-profiles";

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
      <div className="flex flex-1">
        <aside className="hidden w-56 border-r bg-muted/30 md:block">
          <SidebarNav role={role} />
        </aside>
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
