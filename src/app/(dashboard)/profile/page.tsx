import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import {
  DepartmentChangeRequestCard,
  type ProfileDepartmentChangeRequestSummary,
} from "./department-change-request-card";
import { getDepartmentArea, getDepartmentById } from "@/lib/departments";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import type {
  Department,
  DepartmentChangeRequest,
  UserProfile,
} from "@/types";

type ProfilePageProfile = Pick<
  UserProfile,
  | "id"
  | "full_name"
  | "email"
  | "phone"
  | "avatar_url"
  | "employee_id"
  | "company_id"
  | "department_id"
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

  const [{ data: company }, { data: companyDepartments }, { data: changeRequests }] =
    await Promise.all([
      profile.company_id
        ? adminClient
            .from("companies")
            .select("name")
            .eq("id", profile.company_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      profile.company_id
        ? adminClient
            .from("departments")
            .select(
              "id, name, company_id, parent_department_id, is_assignable, created_at"
            )
            .eq("company_id", profile.company_id)
        : Promise.resolve({ data: null, error: null }),
      profile.id
        ? adminClient
            .from("department_change_requests")
            .select(
              "id, user_id, company_id, current_department_id, requested_department_id, request_reason, status, review_notes, created_at, reviewed_at, updated_at"
            )
            .eq("user_id", profile.id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: null, error: null }),
    ]);

  const typedDepartments = (companyDepartments ?? []) as Department[];
  const currentDepartment =
    getDepartmentById(typedDepartments, profile.department_id) ?? null;
  const currentArea =
    getDepartmentArea(typedDepartments, profile.department_id) ?? currentDepartment;
  const typedRequests = ((changeRequests ?? []) as DepartmentChangeRequest[]).map(
    (request) => {
      const currentRequestDepartment =
        getDepartmentById(typedDepartments, request.current_department_id) ?? null;
      const requestedRequestDepartment =
        getDepartmentById(typedDepartments, request.requested_department_id) ?? null;
      const currentRequestArea =
        getDepartmentArea(typedDepartments, request.current_department_id) ??
        currentRequestDepartment;
      const requestedRequestArea =
        getDepartmentArea(typedDepartments, request.requested_department_id) ??
        requestedRequestDepartment;

      return {
        ...request,
        currentAreaName: currentRequestArea?.name ?? "Sin area",
        currentDepartmentName: currentRequestDepartment?.name ?? "Sin departamento",
        requestedAreaName: requestedRequestArea?.name ?? "Sin area",
        requestedDepartmentName:
          requestedRequestDepartment?.name ?? "Sin departamento",
      } satisfies ProfileDepartmentChangeRequestSummary;
    }
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Cuenta"
        title="Mi perfil"
        description="Gestiona tu identidad dentro de ShiftSwap y revisa los datos con los que participas en turnos, conversaciones y aprobaciones."
      />

      <ProfileForm
        profile={profile as ProfilePageProfile}
        companyName={company?.name ?? "Sin empresa"}
        areaName={currentArea?.name ?? "Sin area"}
        departmentName={currentDepartment?.name ?? "Sin departamento"}
        userId={authUser.id}
      />

      {profile.company_id && profile.department_id ? (
        <DepartmentChangeRequestCard
          companyName={company?.name ?? "Sin empresa"}
          currentDepartmentId={profile.department_id}
          currentAreaName={currentArea?.name ?? "Sin area"}
          currentDepartmentName={currentDepartment?.name ?? "Sin departamento"}
          departments={typedDepartments}
          requests={typedRequests}
        />
      ) : null}
    </div>
  );
}
