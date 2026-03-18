import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import type { UserProfile } from "@/types";

type ProfilePageProfile = Pick<
  UserProfile,
  "id" | "full_name" | "email" | "phone" | "avatar_url" | "employee_id"
>;

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const adminClient = createAdminClient();
  const { data: profile, error: profileError } = await adminClient
    .from("user_profiles")
    .select(
      "id, full_name, email, phone, avatar_url, employee_id, company_id, department_id"
    )
    .eq("id", authUser.id)
    .maybeSingle();

  if (profileError) {
    console.error("[profile/page] DB error fetching profile:", profileError);
    redirect("/shifts");
  }

  if (!profile) {
    redirect("/shifts");
  }

  const [{ data: company }, { data: department }] = await Promise.all([
    profile.company_id
      ? adminClient
          .from("companies")
          .select("name")
          .eq("id", profile.company_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    profile.department_id
      ? adminClient
          .from("departments")
          .select("name")
          .eq("id", profile.department_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>

      <ProfileForm
        profile={profile as ProfilePageProfile}
        companyName={company?.name ?? "Sin empresa"}
        departmentName={department?.name ?? "Sin departamento"}
        userId={authUser.id}
      />
    </div>
  );
}
