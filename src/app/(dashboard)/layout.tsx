import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { SidebarNav } from "@/components/layout/sidebar-nav";
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

  const [{ data: profile }, { data: notifications }, unreadResult] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("id", authUser.id).single(),
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", authUser.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authUser.id)
      .eq("read", false),
  ]);

  const typedNotifications = (notifications ?? []) as Notification[];
  const unreadCount = unreadResult.count ?? 0;

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        user={profile}
        initialNotifications={typedNotifications}
        initialUnreadCount={unreadCount}
      />
      <div className="flex flex-1">
        <aside className="hidden w-56 border-r bg-muted/30 md:block">
          <SidebarNav />
        </aside>
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
