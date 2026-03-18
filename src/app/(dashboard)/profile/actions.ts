"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface UpdateProfileResult {
  success?: true;
  error?: string;
}

export async function updateProfile(
  formData: FormData
): Promise<UpdateProfileResult> {
  const fullName = (formData.get("full_name") as string | null)?.trim();
  const phone = (formData.get("phone") as string | null)?.trim() || null;
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const avatarUrl = (formData.get("avatar_url") as string | null)?.trim() || undefined;

  if (!fullName) return { error: "El nombre completo es obligatorio." };
  if (!email) return { error: "El email de contacto es obligatorio." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "No autenticado." };

  const adminClient = createAdminClient();
  const { data: existingProfile, error: existingProfileError } = await adminClient
    .from("user_profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfileError) {
    return { error: existingProfileError.message };
  }

  if (!existingProfile) {
    return { error: "No se encontró tu perfil de usuario." };
  }

  const updates: Record<string, unknown> = {
    full_name: fullName,
    phone,
    email,
  };

  if (avatarUrl !== undefined) {
    updates.avatar_url = avatarUrl;
  }

  const { error } = await adminClient
    .from("user_profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { success: true };
}
