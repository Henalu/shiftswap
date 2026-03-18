import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasAdminPanelAccess } from "@/lib/user-roles";
import type { UserRole } from "@/types";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: rawAccountState } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const accountState = rawAccountState as { role: UserRole } | null;
  if (!hasAdminPanelAccess(accountState?.role ?? "member")) {
    redirect("/shifts");
  }

  return children;
}
