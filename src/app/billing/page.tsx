import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CreditCard,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getBillingMode, isBillingEnabled } from "@/lib/app-config";
import {
  getPublicBillingPlans,
  resolveBillingGateState,
  type PublicBillingPlanOption,
} from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";
import { getAccountGateState } from "@/lib/user-profiles";
import { resolveStripePriceId, stripeReady } from "@/lib/stripe";

const BILLING_STATE_LABELS = {
  inactive: "Sin suscripcion activa",
  trialing: "En trial",
  active: "Activa",
  past_due: "Pago pendiente",
  blocked: "Bloqueada",
} as const;

interface BillingPageProps {
  searchParams: Promise<{
    checkout?: string;
    interval?: string;
    mode?: string;
    price?: string;
    stripe?: string;
  }>;
}

function formatPlanPrice(plan: PublicBillingPlanOption) {
  if (plan.amount_cents <= 0) {
    return "Precio por definir";
  }

  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: plan.currency.toUpperCase(),
  }).format(plan.amount_cents / 100);
}

function intervalLabel(interval: string) {
  return interval === "year" ? "Anual" : "Mensual";
}

function PlanOption({
  interval,
  plans,
  stripeConfigured,
}: {
  interval: "month" | "year";
  plans: PublicBillingPlanOption[];
  stripeConfigured: boolean;
}) {
  const plan = plans.find((candidate) => candidate.billing_interval === interval);
  const stripePriceId = plan ? resolveStripePriceId(plan) : "";
  const disabled = !stripeConfigured || !plan || !stripePriceId;

  return (
    <form
      action="/api/billing/checkout"
      method="post"
      className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-background/85 p-4"
    >
      <input type="hidden" name="billing_interval" value={interval} />
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-foreground">{intervalLabel(interval)}</p>
          {plan?.marketing_badge ? (
            <Badge variant="outline">{plan.marketing_badge}</Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {plan?.price_label ?? "Plan pendiente de configurar"}
        </p>
      </div>

      <div>
        <p className="text-2xl font-semibold tracking-tight text-foreground">
          {plan ? formatPlanPrice(plan) : "No disponible"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {plan?.cohort?.discount_label ?? "Sin cohorte activa"}
        </p>
      </div>

      {plan?.trial_days ? (
        <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800">
          Incluye {plan.trial_days} dias de prueba para las primeras plazas.
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={disabled}>
        {interval === "year" ? "Activar anual" : "Activar mensual"}
      </Button>
    </form>
  );
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const accountState = await getAccountGateState(user.id);

  if (
    accountState?.validation_status === "pending" ||
    accountState?.validation_status === "rejected"
  ) {
    redirect("/pending-validation");
  }

  const billingState = await resolveBillingGateState(user.id, accountState);
  const publicPlans = await getPublicBillingPlans();
  const billingEnabled = isBillingEnabled();
  const mode = getBillingMode();
  const stripeConfigured = stripeReady();
  const selectedCohortPlans = billingState.pricingCohortCode
    ? publicPlans.filter((plan) => plan.cohort_code === billingState.pricingCohortCode)
    : publicPlans.filter(
        (plan) =>
          plan.cohort?.min_position ===
          Math.min(...publicPlans.map((candidate) => candidate.cohort?.min_position ?? 9999))
      );
  const visiblePlans = selectedCohortPlans.length > 0 ? selectedCohortPlans : publicPlans;
  const hasConfiguredStripePrice = visiblePlans.some((plan) =>
    Boolean(resolveStripePriceId(plan))
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10">
      <Card className="w-full border-border/80">
        <CardHeader className="space-y-4">
          <div className="inline-flex size-12 items-center justify-center rounded-2xl border border-border/70 bg-secondary/45">
            <CreditCard className="size-5 text-foreground" />
          </div>
          <div className="space-y-2">
            <CardTitle>Suscripcion y acceso</CardTitle>
            <CardDescription>
              Controla el estado comercial de tu cuenta y regulariza el acceso si
              fuera necesario.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-2xl border border-border/70 bg-secondary/45 px-4 py-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">
              Estado actual: {BILLING_STATE_LABELS[billingState.state]}
            </p>
            <p className="mt-2">
              {billingState.reason ??
                "Tu acceso esta listo para el piloto actual y quedara controlado desde aqui cuando actives billing."}
            </p>
            {billingState.earlyAccessPosition ? (
              <p className="mt-3 text-xs font-medium text-muted-foreground">
                Plaza early adopter #{billingState.earlyAccessPosition}
                {billingState.priceLockEndsAt
                  ? ` - precio bloqueado hasta ${new Date(
                      billingState.priceLockEndsAt
                    ).toLocaleDateString("es-ES")}`
                  : ""}
              </p>
            ) : null}
          </div>

          {params.checkout === "success" ? (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800">
              Checkout completado. Stripe confirmara la suscripcion por webhook.
            </div>
          ) : null}

          {params.checkout === "cancelled" ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
              Checkout cancelado. Puedes elegir mensual o anual cuando quieras.
            </div>
          ) : null}

          {params.price === "missing" ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
              Falta configurar el Price ID de Stripe para el plan seleccionado.
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4 text-sm">
              <p className="font-semibold text-foreground">Modo de cobro</p>
              <p className="mt-2 text-muted-foreground">
                {mode === "user"
                  ? "Suscripcion individual por usuario"
                  : "Suscripcion centralizada por empresa"}
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/80 p-4 text-sm">
              <p className="font-semibold text-foreground">Motor de pago</p>
              <p className="mt-2 text-muted-foreground">
                {stripeConfigured
                  ? "Stripe listo para checkout y portal"
                  : "Stripe aun no esta configurado en este entorno"}
              </p>
            </div>
          </div>

          {billingEnabled ? (
            <div className="space-y-4 rounded-2xl border border-border/70 bg-background/80 p-4">
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-foreground">Detalle comercial</p>
                <p className="text-muted-foreground">
                  Plan: {billingState.planName ?? "Pendiente de elegir"}
                </p>
                <p className="text-muted-foreground">
                  Estado de suscripcion:{" "}
                  {billingState.subscriptionStatus ?? "Sin suscripcion creada"}
                </p>
                <p className="text-muted-foreground">
                  Fin de periodo:{" "}
                  {billingState.currentPeriodEnd
                    ? new Date(billingState.currentPeriodEnd).toLocaleDateString("es-ES")
                    : "No disponible"}
                </p>
              </div>

              {!stripeConfigured ? (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
                  Este entorno no tiene las claves de Stripe listas todavia. La
                  pagina ya esta preparada, pero falta configurar el proveedor.
                </div>
              ) : null}

              {stripeConfigured && !hasConfiguredStripePrice ? (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
                  Stripe esta activo, pero faltan los Price IDs de los planes.
                </div>
              ) : null}

              {billingState.state === "active" || billingState.state === "trialing" || billingState.state === "past_due" ? (
                <form action="/api/billing/portal" method="post">
                  <Button type="submit" className="w-full" disabled={!stripeConfigured}>
                    Gestionar suscripcion
                  </Button>
                </form>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  <PlanOption
                    interval="month"
                    plans={visiblePlans}
                    stripeConfigured={stripeConfigured}
                  />
                  <PlanOption
                    interval="year"
                    plans={visiblePlans}
                    stripeConfigured={stripeConfigured}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-800">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">
                    Billing desactivado durante el piloto
                  </p>
                  <p>
                    El gate comercial esta preparado, pero el acceso sigue
                    abierto para facilitar las pruebas reales antes del cobro.
                  </p>
                </div>
              </div>
            </div>
          )}

          {billingState.state === "blocked" ? (
            <div className="rounded-2xl border border-destructive/15 bg-destructive/10 px-4 py-4 text-sm text-destructive">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">
                    Tu acceso operativo esta bloqueado
                  </p>
                  <p>
                    Necesitas activar o regularizar la suscripcion antes de
                    volver al dashboard.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-4 text-sm">
            <Link
              href="/legal/terms"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Terminos
            </Link>
            <Link
              href="/legal/privacy"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Privacidad
            </Link>
            <Link
              href="/legal/billing"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Facturacion
            </Link>
            <Link
              href="/legal/data-processing"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Documentos y RGPD
            </Link>
          </div>
        </CardContent>

        <CardFooter className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="outline">
            <Link href="/shifts">
              <ArrowLeft className="size-4" />
              Volver al dashboard
            </Link>
          </Button>
          <p className="text-sm text-muted-foreground">
            El modelo de acceso comercial esta preparado para usuario y empresa.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
