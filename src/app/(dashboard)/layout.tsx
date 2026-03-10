import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import {
  CalendarDays,
  CalendarCheck,
  MessageSquare,
  Repeat,
  User,
} from "lucide-react";
import type { Notification } from "@/types";

const navItems = [
  { href: "/shifts", label: "Turnos", icon: CalendarDays },
  { href: "/shifts/my", label: "Mis turnos", icon: CalendarCheck },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/exchanges", label: "Intercambios", icon: Repeat },
  { href: "/profile", label: "Perfil", icon: User },
];

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

  const [{ data: profile }, { data: notifications }] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("id", authUser.id).single(),
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", authUser.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const typedNotifications = (notifications ?? []) as Notification[];
  const unreadCount = typedNotifications.filter((n) => !n.read).length;

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        user={profile}
        initialNotifications={typedNotifications}
        initialUnreadCount={unreadCount}
      />
      <div className="flex flex-1">
        <aside className="hidden w-56 border-r bg-muted/30 md:block">
          <SidebarNav items={navItems} />
        </aside>
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
