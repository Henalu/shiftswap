"use server";

import { createAdminClient } from "@/lib/supabase/admin";

const ID_CARD_BUCKET = "id-cards";
const MAX_ID_CARD_SIZE = 5 * 1024 * 1024;

const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

const ALLOWED_ID_CARD_MIME_TYPES = new Set(Object.values(MIME_TYPES_BY_EXTENSION));

export interface RegisterEmployeeResult {
  success?: true;
  error?: string;
}

function getNormalizedIdCardMimeType(file: File): string | null {
  if (ALLOWED_ID_CARD_MIME_TYPES.has(file.type)) {
    return file.type;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension) return null;

  return MIME_TYPES_BY_EXTENSION[extension] ?? null;
}

async function rollbackRegistration(
  userId: string,
  idCardPath: string | null
): Promise<void> {
  const supabase = createAdminClient();

  if (idCardPath) {
    const { error: removeError } = await supabase.storage
      .from(ID_CARD_BUCKET)
      .remove([idCardPath]);

    if (removeError) {
      console.error("[register] Failed to remove uploaded ID card during rollback", {
        userId,
        idCardPath,
        message: removeError.message,
      });
    }
  }

  const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);

  if (deleteUserError) {
    console.error("[register] Failed to delete auth user during rollback", {
      userId,
      message: deleteUserError.message,
    });
  }
}

export async function registerEmployee(
  formData: FormData
): Promise<RegisterEmployeeResult> {
  const fullName = (formData.get("full_name") as string | null)?.trim();
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const password = (formData.get("password") as string | null) ?? "";
  const companyId = (formData.get("company_id") as string | null)?.trim();
  const departmentId = (formData.get("department_id") as string | null)?.trim();
  const employeeId = (formData.get("employee_id") as string | null)?.trim();
  const idCard = formData.get("id_card");

  if (!fullName) return { error: "El nombre completo es obligatorio." };
  if (!email) return { error: "El email es obligatorio." };
  if (!password || password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }
  if (!companyId) return { error: "Selecciona una empresa." };
  if (!departmentId) return { error: "Selecciona un departamento." };
  if (!employeeId) return { error: "El ID de empleado es obligatorio." };

  if (!(idCard instanceof File) || idCard.size === 0) {
    return { error: "La foto del carné es obligatoria." };
  }

  if (idCard.size > MAX_ID_CARD_SIZE) {
    return { error: "La imagen del carné no puede superar los 5 MB." };
  }

  const idCardMimeType = getNormalizedIdCardMimeType(idCard);
  if (!idCardMimeType) {
    return {
      error: "El carné debe estar en formato JPG, PNG, WEBP, HEIC o HEIF.",
    };
  }

  const supabase = createAdminClient();

  const { data: department, error: departmentError } = await supabase
    .from("departments")
    .select("id, company_id")
    .eq("id", departmentId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (departmentError) {
    return { error: "No se pudo validar el departamento seleccionado." };
  }

  if (!department) {
    return { error: "La empresa y el departamento seleccionados no coinciden." };
  }

  const { data: createdUserData, error: createUserError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

  if (createUserError || !createdUserData.user) {
    return {
      error:
        createUserError?.message === "A user with this email address has already been registered"
          ? "Ya existe una cuenta registrada con ese email."
          : createUserError?.message ?? "No se pudo crear la cuenta.",
    };
  }

  const userId = createdUserData.user.id;
  const idCardPath = `${userId}/id_card`;
  const idCardBytes = new Uint8Array(await idCard.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(ID_CARD_BUCKET)
    .upload(idCardPath, idCardBytes, {
      contentType: idCardMimeType,
      upsert: true,
    });

  if (uploadError) {
    await rollbackRegistration(userId, null);
    return { error: `No se pudo subir el carné: ${uploadError.message}` };
  }

  const { error: profileError } = await supabase.from("user_profiles").insert({
    id: userId,
    email,
    full_name: fullName,
    company_id: companyId,
    department_id: departmentId,
    role: "member",
    employee_id: employeeId,
    id_card_url: idCardPath,
    validation_status: "pending",
    validation_notes: null,
    is_admin: false,
  });

  if (profileError) {
    await rollbackRegistration(userId, idCardPath);
    return {
      error:
        "No se pudo crear tu perfil de validación. Por favor inténtalo de nuevo. (" +
        profileError.message +
        ")",
    };
  }

  return { success: true };
}
