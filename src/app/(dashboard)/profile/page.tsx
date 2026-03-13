import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import type { UserProfile, Department } from "@/types";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>;
}) {
  const { setup } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  // Fetch departments: filtered by company if profile exists, otherwise all
  const deptQuery = profile
    ? supabase
        .from("departments")
        .select("id, name, company_id, created_at")
        .eq("company_id", profile.company_id)
        .order("name")
    : supabase
        .from("departments")
        .select("id, name, company_id, created_at")
        .order("name");

  const { data: departments, error: deptError } = await deptQuery;

  if (deptError) {
    console.error("[profile/page] DB error fetching departments:", deptError);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>

      <ProfileForm
        profile={(profile as UserProfile) ?? null}
        departments={(departments ?? []) as Department[]}
        userId={authUser.id}
        userEmail={authUser.email!}
        showSetupBanner={!!setup}
      />
    </div>
  );
}
