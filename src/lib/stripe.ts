import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import {
  getStripePriceIdFromEnv,
  getStripeSecretKey,
  getStripeWebhookSecret,
  isStripeConfigured,
} from "@/lib/app-config";

interface StripeErrorResponse {
  error?: {
    message?: string;
  };
}

export interface StripeCustomerResponse {
  id: string;
  email?: string | null;
}

export interface StripeCheckoutSessionResponse {
  id: string;
  url: string | null;
  customer?: string | null;
  subscription?: string | null;
}

export interface StripePortalSessionResponse {
  id: string;
  url: string;
}

export function stripeReady() {
  return isStripeConfigured();
}

export function resolveStripePriceId(input: {
  stripe_price_id?: string | null;
  stripe_price_env_var?: string | null;
}) {
  return (
    input.stripe_price_id?.trim() ||
    getStripePriceIdFromEnv(input.stripe_price_env_var) ||
    ""
  );
}

async function stripeRequest<TResponse>(
  path: string,
  body: URLSearchParams
): Promise<TResponse> {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getStripeSecretKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  const payload = (await response.json()) as
    | TResponse
    | StripeErrorResponse;

  if (!response.ok) {
    throw new Error(
      (payload as StripeErrorResponse).error?.message ??
        "Stripe no ha aceptado la solicitud."
    );
  }

  return payload as TResponse;
}

export async function createStripeCustomer(input: {
  email: string;
  fullName?: string | null;
  metadata?: Record<string, string>;
}) {
  const body = new URLSearchParams();
  body.set("email", input.email);

  if (input.fullName?.trim()) {
    body.set("name", input.fullName.trim());
  }

  if (input.metadata) {
    Object.entries(input.metadata).forEach(([key, value]) => {
      body.set(`metadata[${key}]`, value);
    });
  }

  return stripeRequest<StripeCustomerResponse>("customers", body);
}

export async function createStripeCheckoutSession(input: {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  clientReferenceId?: string | null;
  trialDays?: number;
  metadata?: Record<string, string>;
}) {
  const body = new URLSearchParams();
  body.set("mode", "subscription");
  body.set("customer", input.customerId);
  body.set("success_url", input.successUrl);
  body.set("cancel_url", input.cancelUrl);
  body.set("line_items[0][price]", input.priceId);
  body.set("line_items[0][quantity]", "1");
  body.set("allow_promotion_codes", "true");

  if (input.clientReferenceId) {
    body.set("client_reference_id", input.clientReferenceId);
  }

  if (input.trialDays && input.trialDays > 0) {
    body.set("subscription_data[trial_period_days]", String(input.trialDays));
  }

  if (input.metadata) {
    Object.entries(input.metadata).forEach(([key, value]) => {
      body.set(`metadata[${key}]`, value);
      body.set(`subscription_data[metadata][${key}]`, value);
    });
  }

  return stripeRequest<StripeCheckoutSessionResponse>(
    "checkout/sessions",
    body
  );
}

export async function createStripePortalSession(input: {
  customerId: string;
  returnUrl: string;
}) {
  const body = new URLSearchParams();
  body.set("customer", input.customerId);
  body.set("return_url", input.returnUrl);

  return stripeRequest<StripePortalSessionResponse>(
    "billing_portal/sessions",
    body
  );
}

function parseStripeSignatureHeader(signature: string) {
  return signature.split(",").reduce<Record<string, string[]>>((acc, part) => {
    const [key, value] = part.split("=");
    if (!key || !value) return acc;

    if (!acc[key]) {
      acc[key] = [];
    }

    acc[key].push(value);
    return acc;
  }, {});
}

export function verifyStripeWebhookSignature(
  payload: string,
  signatureHeader: string | null
) {
  if (!signatureHeader || !getStripeWebhookSecret()) {
    return false;
  }

  const parsed = parseStripeSignatureHeader(signatureHeader);
  const timestamp = parsed.t?.[0];
  const signatures = parsed.v1 ?? [];

  if (!timestamp || signatures.length === 0) {
    return false;
  }

  const expected = createHmac("sha256", getStripeWebhookSecret())
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected);

  return signatures.some((candidate) => {
    const candidateBuffer = Buffer.from(candidate);

    return (
      candidateBuffer.length === expectedBuffer.length &&
      timingSafeEqual(candidateBuffer, expectedBuffer)
    );
  });
}
