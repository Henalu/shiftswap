import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncBillingAccountState } from "@/lib/billing";
import {
  resolveStripePriceId,
  verifyStripeWebhookSignature,
} from "@/lib/stripe";
import type { BillingSubscriptionStatus } from "@/types";

interface StripeEvent {
  id: string;
  type: string;
  data?: {
    object?: Record<string, unknown>;
  };
}

function toIsoTimestamp(value: unknown) {
  if (typeof value !== "number") {
    return null;
  }

  return new Date(value * 1000).toISOString();
}

function toSubscriptionStatus(value: unknown): BillingSubscriptionStatus {
  switch (value) {
    case "trialing":
    case "active":
    case "past_due":
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
    case "canceled":
      return value;
    default:
      return "incomplete";
  }
}

async function loadBillingAccountIdByCustomer(
  providerCustomerId: string | null
) {
  if (!providerCustomerId) {
    return null;
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("billing_accounts")
    .select("id")
    .eq("provider_customer_id", providerCustomerId)
    .maybeSingle();

  return data?.id ?? null;
}

async function resolveBillingPlanId(priceId: string | null) {
  if (!priceId) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("billing_plans")
    .select("id")
    .eq("stripe_price_id", priceId)
    .maybeSingle();

  if (data?.id) {
    return data.id as string;
  }

  const { data: plans } = await supabase
    .from("billing_plans")
    .select("id, stripe_price_id, stripe_price_env_var")
    .eq("owner_type", "user")
    .eq("active", true)
    .eq("is_public", true);

  const match = (plans ?? []).find(
    (plan) =>
      resolveStripePriceId({
        stripe_price_id: plan.stripe_price_id,
        stripe_price_env_var: plan.stripe_price_env_var,
      }) === priceId
  );

  return match?.id ?? null;
}

async function upsertSubscriptionFromStripeObject(
  stripeObject: Record<string, unknown>
) {
  const providerCustomerId =
    typeof stripeObject.customer === "string" ? stripeObject.customer : null;
  const providerSubscriptionId =
    typeof stripeObject.id === "string" ? stripeObject.id : null;

  if (!providerCustomerId || !providerSubscriptionId) {
    return;
  }

  const billingAccountId = await loadBillingAccountIdByCustomer(providerCustomerId);
  if (!billingAccountId) {
    return;
  }

  const items =
    stripeObject.items &&
    typeof stripeObject.items === "object" &&
    Array.isArray((stripeObject.items as { data?: unknown[] }).data)
      ? ((stripeObject.items as { data?: Record<string, unknown>[] }).data ?? [])
      : [];
  const firstItem = items[0] ?? null;
  const price =
    firstItem &&
    typeof firstItem.price === "object" &&
    firstItem.price
      ? (firstItem.price as Record<string, unknown>)
      : null;
  const priceId = price && typeof price.id === "string" ? price.id : null;
  const metadata =
    stripeObject.metadata && typeof stripeObject.metadata === "object"
      ? (stripeObject.metadata as Record<string, unknown>)
      : {};
  const metadataPlanId =
    typeof metadata.billing_plan_id === "string" ? metadata.billing_plan_id : null;
  const planId = (await resolveBillingPlanId(priceId)) ?? metadataPlanId;
  const status = toSubscriptionStatus(stripeObject.status);
  const supabase = createAdminClient();

  await supabase
    .from("billing_subscriptions")
    .upsert(
      {
        billing_account_id: billingAccountId,
        billing_plan_id: planId,
        provider: "stripe",
        provider_subscription_id: providerSubscriptionId,
        provider_price_id: priceId,
        status,
        current_period_start: toIsoTimestamp(stripeObject.current_period_start),
        current_period_end: toIsoTimestamp(stripeObject.current_period_end),
        cancel_at_period_end: Boolean(stripeObject.cancel_at_period_end),
        canceled_at: toIsoTimestamp(stripeObject.canceled_at),
        trial_start: toIsoTimestamp(stripeObject.trial_start),
        trial_end: toIsoTimestamp(stripeObject.trial_end),
        metadata,
      },
      { onConflict: "provider_subscription_id" }
    );

  await syncBillingAccountState({
    accountId: billingAccountId,
    subscriptionStatus: status,
    trialEnd: toIsoTimestamp(stripeObject.trial_end),
  });
}

async function upsertInvoiceFromStripeObject(stripeObject: Record<string, unknown>) {
  const providerCustomerId =
    typeof stripeObject.customer === "string" ? stripeObject.customer : null;
  const providerInvoiceId =
    typeof stripeObject.id === "string" ? stripeObject.id : null;

  if (!providerCustomerId || !providerInvoiceId) {
    return;
  }

  const billingAccountId = await loadBillingAccountIdByCustomer(providerCustomerId);
  if (!billingAccountId) {
    return;
  }

  const providerSubscriptionId =
    typeof stripeObject.subscription === "string" ? stripeObject.subscription : null;
  const statusTransitions =
    stripeObject.status_transitions &&
    typeof stripeObject.status_transitions === "object"
      ? (stripeObject.status_transitions as Record<string, unknown>)
      : null;
  const supabase = createAdminClient();
  const { data: subscription } = providerSubscriptionId
    ? await supabase
        .from("billing_subscriptions")
        .select("id")
        .eq("provider_subscription_id", providerSubscriptionId)
        .maybeSingle()
    : { data: null };

  await supabase
    .from("billing_invoices")
    .upsert(
      {
        billing_account_id: billingAccountId,
        billing_subscription_id: subscription?.id ?? null,
        provider: "stripe",
        provider_invoice_id: providerInvoiceId,
        status:
          typeof stripeObject.status === "string"
            ? stripeObject.status
            : "open",
        currency:
          typeof stripeObject.currency === "string"
            ? stripeObject.currency
            : "eur",
        amount_due_cents:
          typeof stripeObject.amount_due === "number"
            ? Math.round(stripeObject.amount_due)
            : 0,
        amount_paid_cents:
          typeof stripeObject.amount_paid === "number"
            ? Math.round(stripeObject.amount_paid)
            : 0,
        hosted_invoice_url:
          typeof stripeObject.hosted_invoice_url === "string"
            ? stripeObject.hosted_invoice_url
            : null,
        invoice_pdf_url:
          typeof stripeObject.invoice_pdf === "string"
            ? stripeObject.invoice_pdf
            : null,
        period_start: toIsoTimestamp(stripeObject.period_start),
        period_end: toIsoTimestamp(stripeObject.period_end),
        paid_at: toIsoTimestamp(statusTransitions?.paid_at),
      },
      { onConflict: "provider_invoice_id" }
    );
}

async function persistWebhookEvent(event: StripeEvent, payload: Record<string, unknown>) {
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("billing_webhook_events")
    .select("id, processed")
    .eq("provider", "stripe")
    .eq("provider_event_id", event.id)
    .maybeSingle();

  if (existing?.processed) {
    return {
      id: existing.id,
      alreadyProcessed: true,
    };
  }

  const { data } = await supabase
    .from("billing_webhook_events")
    .upsert(
      {
        provider: "stripe",
        provider_event_id: event.id,
        event_type: event.type,
        payload,
        processed: false,
      },
      { onConflict: "provider_event_id" }
    )
    .select("id")
    .single();

  return {
    id: data?.id ?? existing?.id ?? "",
    alreadyProcessed: false,
  };
}

async function markWebhookEventProcessed(recordId: string) {
  const supabase = createAdminClient();
  await supabase
    .from("billing_webhook_events")
    .update({
      processed: true,
      processed_at: new Date().toISOString(),
    })
    .eq("id", recordId);
}

export async function POST(request: Request) {
  const signatureHeader = request.headers.get("stripe-signature");
  const payloadText = await request.text();

  if (!verifyStripeWebhookSignature(payloadText, signatureHeader)) {
    return new NextResponse("Invalid Stripe signature", { status: 400 });
  }

  const event = JSON.parse(payloadText) as StripeEvent;
  const stored = await persistWebhookEvent(
    event,
    JSON.parse(payloadText) as Record<string, unknown>
  );

  if (stored.alreadyProcessed) {
    return NextResponse.json({ received: true });
  }

  const stripeObject =
    event.data?.object && typeof event.data.object === "object"
      ? event.data.object
      : null;

  if (stripeObject) {
    switch (event.type) {
      case "checkout.session.completed": {
        const customerId =
          typeof stripeObject.customer === "string" ? stripeObject.customer : null;
        const billingAccountId =
          stripeObject.metadata &&
          typeof stripeObject.metadata === "object" &&
          typeof (stripeObject.metadata as Record<string, unknown>).billing_account_id ===
            "string"
            ? ((stripeObject.metadata as Record<string, unknown>)
                .billing_account_id as string)
            : null;
        const metadata =
          stripeObject.metadata && typeof stripeObject.metadata === "object"
            ? (stripeObject.metadata as Record<string, unknown>)
            : {};
        const billingPlanId =
          typeof metadata.billing_plan_id === "string" ? metadata.billing_plan_id : null;
        const pricingCohortCode =
          typeof metadata.pricing_cohort_code === "string"
            ? metadata.pricing_cohort_code
            : null;
        const billingInterval =
          metadata.billing_interval === "year" ? "year" : metadata.billing_interval === "month" ? "month" : null;
        const earlyAccessPosition =
          typeof metadata.early_access_position === "string"
            ? Number.parseInt(metadata.early_access_position, 10)
            : null;

        if (customerId && billingAccountId) {
          const supabase = createAdminClient();
          const updatePayload: Record<string, unknown> = {
            provider_customer_id: customerId,
          };

          if (billingPlanId) {
            updatePayload.billing_plan_id = billingPlanId;
          }

          if (pricingCohortCode) {
            updatePayload.pricing_cohort_code = pricingCohortCode;
          }

          if (billingInterval) {
            updatePayload.billing_interval = billingInterval;
          }

          if (earlyAccessPosition && Number.isFinite(earlyAccessPosition)) {
            updatePayload.early_access_position = earlyAccessPosition;
          }

          await supabase
            .from("billing_accounts")
            .update(updatePayload)
            .eq("id", billingAccountId);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await upsertSubscriptionFromStripeObject(stripeObject);
        break;
      case "invoice.created":
      case "invoice.finalized":
      case "invoice.paid":
      case "invoice.payment_failed":
        await upsertInvoiceFromStripeObject(stripeObject);
        if (event.type === "invoice.payment_failed") {
          const customerId =
            typeof stripeObject.customer === "string" ? stripeObject.customer : null;
          const billingAccountId = await loadBillingAccountIdByCustomer(customerId);

          if (billingAccountId) {
            await syncBillingAccountState({
              accountId: billingAccountId,
              subscriptionStatus: "past_due",
            });
          }
        }
        break;
      default:
        break;
    }
  }

  await markWebhookEventProcessed(stored.id);
  return NextResponse.json({ received: true });
}
