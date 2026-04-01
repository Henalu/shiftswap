import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole, ValidationStatus } from "@/types";

export const USER_PROFILE_PUBLIC_SELECT =
  "id, email, full_name, company_id, department_id, role, avatar_url, phone, created_at, updated_at";

export interface AccountGateState {
  validation_status: ValidationStatus;
  validation_notes: string | null;
  role: UserRole;
  company_id: string | null;
  department_id: string | null;
  job_position_id?: string | null;
}

const SIGNATURE_REQUIRED_ERROR =
  "Configura tu firma digital en el perfil antes de continuar.";

/**
 * Checks whether a user has configured their digital signature.
 * Returns the signature URL if it exists, or null.
 */
export async function getUserSignatureUrl(
  userId: string
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("user_profiles")
    .select("signature_url")
    .eq("id", userId)
    .maybeSingle();

  return (data as { signature_url: string | null } | null)?.signature_url ?? null;
}

/**
 * Asserts that the user has a signature configured.
 * Returns { error } if not, so callers can early-return.
 */
export async function requireSignature(
  userId: string
): Promise<{ error: string } | { error: null; signatureUrl: string }> {
  const signatureUrl = await getUserSignatureUrl(userId);
  if (!signatureUrl) {
    return { error: SIGNATURE_REQUIRED_ERROR };
  }
  return { error: null, signatureUrl };
}

export async function getAccountGateState(
  userId: string
): Promise<AccountGateState | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      "validation_status, validation_notes, role, company_id, department_id, job_position_id"
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[user-profiles] Failed to fetch account gate state", {
      userId,
      message: error.message,
    });
    return null;
  }

  return (data as AccountGateState | null) ?? null;
}
