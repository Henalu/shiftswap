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
}

export async function getAccountGateState(
  userId: string
): Promise<AccountGateState | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("user_profiles")
    .select("validation_status, validation_notes, role, company_id, department_id")
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
