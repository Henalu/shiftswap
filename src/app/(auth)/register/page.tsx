import RegisterForm from "./register-form";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Company, Department } from "@/types";

export default async function RegisterPage() {
  const supabase = createAdminClient();

  const [{ data: companies }, { data: departments }] = await Promise.all([
    supabase.from("companies").select("id, name, slug, created_at").order("name"),
    supabase
      .from("departments")
      .select("id, name, company_id, parent_department_id, is_assignable, created_at")
      .order("name"),
  ]);

  return (
    <RegisterForm
      companies={(companies ?? []) as Company[]}
      departments={(departments ?? []) as Department[]}
    />
  );
}
