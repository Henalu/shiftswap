import type { User } from "@supabase/supabase-js";

export const REQUIRED_PASSWORD_CHANGE_KEY =
  "shiftswap_password_change_required";
const REQUIRED_PASSWORD_CHANGE_REASON_KEY =
  "shiftswap_password_change_reason";
const REQUIRED_PASSWORD_CHANGE_SET_AT_KEY =
  "shiftswap_password_change_set_at";

type AppMetadata = User["app_metadata"];

export function isPasswordChangeRequired(
  user: Pick<User, "app_metadata"> | null | undefined
) {
  return user?.app_metadata?.[REQUIRED_PASSWORD_CHANGE_KEY] === true;
}

export function getRequiredPasswordChangePath() {
  return "/reset-password?reason=temporary-password";
}

export function buildRequiredPasswordChangeAppMetadata(
  appMetadata: AppMetadata = {}
) {
  return {
    ...appMetadata,
    [REQUIRED_PASSWORD_CHANGE_KEY]: true,
    [REQUIRED_PASSWORD_CHANGE_REASON_KEY]: "platform_temporary_password",
    [REQUIRED_PASSWORD_CHANGE_SET_AT_KEY]: new Date().toISOString(),
  };
}

export function clearRequiredPasswordChangeAppMetadata(
  appMetadata: AppMetadata = {}
) {
  const nextMetadata = { ...appMetadata };

  nextMetadata[REQUIRED_PASSWORD_CHANGE_KEY] = null;
  nextMetadata[REQUIRED_PASSWORD_CHANGE_REASON_KEY] = null;
  nextMetadata[REQUIRED_PASSWORD_CHANGE_SET_AT_KEY] = null;

  return nextMetadata;
}
