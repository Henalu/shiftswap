"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface UpdateProfileResult {
  error?: string;
}

export async function updateProfile(
  formData: FormData
): Promise<UpdateProfileResult> {
  const fullName = (formData.get("full_name") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim() || null;
  const departmentId = formData.get("department_id") as string;
  const avatarUrl = (formData.get("avatar_url") as string)?.trim() || undefined;

  if (!fullName) return { error: "El nombre completo es obligatorio." };
  if (!departmentId) return { error: "El departamento es obligatorio." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "No autenticado." };

  // Check if the profile already exists
  const { data: existing } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) {
    // UPDATE — preserve role and other immutable fields
    const updates: Record<string, unknown> = {
      full_name: fullName,
      phone,
      department_id: departmentId,
    };
    if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;

    const { error } = await supabase
      .from("user_profiles")
      .update(updates)
      .eq("id", user.id);

    if (error) return { error: error.message };
  } else {
    // INSERT — first time profile creation
    const { data: dept } = await supabase
      .from("departments")
      .select("company_id")
      .eq("id", departmentId)
      .single();

    if (!dept) return { error: "Departamento no válido." };

    const insertData: Record<string, unknown> = {
      id: user.id,
      email: user.email!,
      full_name: fullName,
      phone,
      department_id: departmentId,
      company_id: dept.company_id,
      role: "employee",
    };
    if (avatarUrl !== undefined) insertData.avatar_url = avatarUrl;

    const { error } = await supabase.from("user_profiles").insert(insertData);
    if (error) return { error: error.message };
  }

  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return {};
}
