import type {
  BillingEnforcementMode,
  BillingOwnerType,
} from "@/types";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function parseBooleanFlag(value: string | undefined, fallback = false) {
  if (!value) return fallback;
  return TRUE_VALUES.has(value.trim().toLowerCase());
}

function normalizeUrl(value: string | undefined) {
  if (!value) {
    return "http://localhost:3000";
  }

  return value.replace(/\/+$/, "");
}

export function getAppUrl() {
  return normalizeUrl(process.env.NEXT_PUBLIC_APP_URL);
}

export function isBillingEnabled() {
  return parseBooleanFlag(process.env.BILLING_ENABLED, false);
}

export function getBillingMode(): BillingOwnerType {
  return process.env.BILLING_MODE === "company" ? "company" : "user";
}

export function getBillingEnforcement(): BillingEnforcementMode {
  const value = process.env.BILLING_ENFORCEMENT?.trim().toLowerCase();

  if (value === "soft" || value === "hard") {
    return value;
  }

  return "off";
}

export function getTurnstileSiteKey() {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "";
}

export function getTurnstileSecretKey() {
  return process.env.TURNSTILE_SECRET_KEY?.trim() || "";
}

export function isTurnstileEnabled() {
  return Boolean(getTurnstileSiteKey() && getTurnstileSecretKey());
}

export function getStripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() || "";
}

export function getStripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || "";
}

export function getStripePriceIdFromEnv(envVarName: string | null | undefined) {
  if (!envVarName) {
    return "";
  }

  return process.env[envVarName]?.trim() || "";
}

export function isStripeConfigured() {
  return Boolean(getStripeSecretKey());
}

export function getResendApiKey() {
  return process.env.RESEND_API_KEY?.trim() || "";
}

export function getResendFromEmail() {
  return process.env.RESEND_FROM_EMAIL?.trim() || "";
}

export function getSuggestionsToEmail() {
  return process.env.SUGGESTIONS_TO_EMAIL?.trim() || "";
}
