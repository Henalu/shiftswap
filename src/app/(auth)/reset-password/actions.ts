"use server";

import { redirect } from "next/navigation";
import {
  clearRequiredPasswordChangeAppMetadata,
  isPasswordChangeRequired,
} from "@/lib/auth/required-password-change";
import {
  getPasswordPolicyMessage,
  validatePasswordPolicy,
} from "@/lib/auth/password-policy";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function getResetPasswordPath(params: { error?: string; status?: string }) {
  const searchParams = new URLSearchParams();

  if (params.error) searchParams.set("error", params.error);
  if (params.status) searchParams.set("status", params.status);

  const query = searchParams.toString();
  return query ? `/reset-password?${query}` : "/reset-password";
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function updatePassword(formData: FormData) {
  const password = getString(formData, "password");
  const confirmPassword = getString(formData, "confirmPassword");
  const validation = validatePasswordPolicy(password);

  if (!validation.ok) {
    redirect(
      getResetPasswordPath({
        error: getPasswordPolicyMessage(validation.error),
      })
    );
  }

  if (password !== confirmPassword) {
    redirect(
      getResetPasswordPath({
        error: "Las dos contrasenas deben coincidir.",
      })
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(
      getResetPasswordPath({
        error:
          "Abre esta pantalla desde el enlace de recuperacion o vuelve a iniciar sesion.",
      })
    );
  }

  const passwordChangeRequired = isPasswordChangeRequired(user);
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(
      getResetPasswordPath({
        error: "No se pudo actualizar la contrasena.",
      })
    );
  }

  if (passwordChangeRequired) {
    const admin = createAdminClient();
    const { error: metadataError } = await admin.auth.admin.updateUserById(
      user.id,
      {
        app_metadata: clearRequiredPasswordChangeAppMetadata(user.app_metadata),
      }
    );

    if (metadataError) {
      redirect(
        getResetPasswordPath({
          error:
            "La contrasena se actualizo, pero no se pudo cerrar el cambio obligatorio.",
        })
      );
    }
  }

  await supabase.auth.signOut();
  redirect("/login?status=password-updated");
}
