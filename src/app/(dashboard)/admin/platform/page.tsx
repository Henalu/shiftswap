import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Palette,
  Repeat,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ColorPaletteField } from "@/components/ui/color-palette-field";
import { PageHeader } from "@/components/ui/page-header";
import { getCompanyThemeAccentColor } from "@/lib/company-theme";
import {
  canManagePlatform,
  getActivePlatformAdminForUser,
} from "@/lib/platform-console";
import { updatePlatformCompanyThemeAction } from "@/lib/platform-console-actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAccountGateState } from "@/lib/user-profiles";
import { isSuperAdmin, USER_ROLE_LABELS } from "@/lib/user-roles";
import { cn } from "@/lib/utils";
import type {
  BillingAccessState,
  BillingInterval,
  ExchangeStatus,
  ShiftStatus,
  UserRole,
  ValidationStatus,
} from "@/types";

interface CompanyRow {
  id: string;
  name: string;
  slug: string;
  theme_config: Record<string, unknown> | null;
  created_at: string;
}

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  company_id: string | null;
  validation_status: ValidationStatus;
  created_at: string;
}

interface BillingAccountRow {
  id: string;
  owner_type: "user" | "company";
  owner_user_id: string | null;
  owner_company_id: string | null;
  current_billing_state: BillingAccessState;
  pricing_cohort_code: string | null;
  billing_interval: BillingInterval | null;
  early_access_position: number | null;
  trial_ends_at: string | null;
  price_lock_ends_at: string | null;
  billing_email: string | null;
  provider_customer_id: string | null;
  created_at: string;
  billing_plan:
    | {
        code: string;
        name: string;
        amount_cents: number;
        currency: string;
        billing_interval: BillingInterval;
      }
    | {
        code: string;
        name: string;
        amount_cents: number;
        currency: string;
        billing_interval: BillingInterval;
      }[]
    | null;
}

interface CohortRow {
  code: string;
  label: string;
  min_position: number;
  max_position: number | null;
  discount_label: string;
}

interface ShiftRow {
  id: string;
  user_id: string;
  status: ShiftStatus;
  created_at: string;
}

interface ExchangeRow {
  id: string;
  user_a_id: string;
  user_b_id: string;
  status: ExchangeStatus;
  created_at: string;
}

function pickRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

const errorCopy: Record<string, string> = {
  "authentication-required": "Inicia sesion para continuar.",
  "company-not-found": "No se encontro la empresa.",
  "company-theme-save-failed": "No se pudo guardar el color corporativo.",
  forbidden: "Tu usuario no tiene rol activo de plataforma.",
  "invalid-company-theme":
    "Usa un color hexadecimal valido, por ejemplo #2563eb.",
  "permission-denied":
    "Solo el admin principal de plataforma puede cambiar el color.",
};

const successCopy: Record<string, string> = {
  "company-theme-updated": "Color corporativo actualizado.",
};

function Feedback({
  error,
  status,
}: {
  error?: string;
  status?: string;
}) {
  const errorMessage = error ? errorCopy[error] ?? errorCopy.forbidden : null;
  const successMessage = status ? successCopy[status] : null;

  if (!errorMessage && !successMessage) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm",
        errorMessage
          ? "border-destructive/20 bg-destructive/10 text-destructive"
          : "border-emerald-500/20 bg-emerald-500/10 text-emerald-800"
      )}
    >
      <div className="flex items-start gap-3">
        {errorMessage ? (
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
        ) : (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
        )}
        <p>{errorMessage ?? successMessage}</p>
      </div>
    </div>
  );
}

function monthKey(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthBuckets() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);

    return {
      key: monthKey(date),
      label: date.toLocaleDateString("es-ES", {
        month: "short",
        year: "2-digit",
      }),
    };
  });
}

function countByMonth(rows: { created_at: string }[], buckets: { key: string }[]) {
  const counts = new Map(buckets.map((bucket) => [bucket.key, 0]));

  rows.forEach((row) => {
    const key = monthKey(row.created_at);
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  });

  return buckets.map((bucket) => counts.get(bucket.key) ?? 0);
}

function formatCurrency(amountCents: number, currency = "eur") {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}

function estimateMonthlyRevenue(accounts: BillingAccountRow[]) {
  return accounts.reduce((total, account) => {
    if (!["trialing", "active", "past_due"].includes(account.current_billing_state)) {
      return total;
    }

    const plan = pickRelation(account.billing_plan);
    if (!plan?.amount_cents) {
      return total;
    }

    return total + (plan.billing_interval === "year" ? plan.amount_cents / 12 : plan.amount_cents);
  }, 0);
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardDescription>{label}</CardDescription>
          <CardTitle className="text-2xl">{value}</CardTitle>
        </div>
        <div className="rounded-xl border border-border/70 bg-secondary/50 p-2">
          <Icon className="size-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

interface PlatformAdminPageProps {
  searchParams: Promise<{
    error?: string;
    status?: string;
  }>;
}

export default async function PlatformAdminPage({
  searchParams,
}: PlatformAdminPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const accountState = await getAccountGateState(user.id);
  if (!accountState || !isSuperAdmin(accountState.role)) {
    redirect("/admin/exchanges");
  }

  const platformAdmin = await getActivePlatformAdminForUser(user.id);
  const canManageCompanyTheme = canManagePlatform(platformAdmin);
  const admin = createAdminClient();
  const buckets = buildMonthBuckets();
  const since = new Date();
  since.setMonth(since.getMonth() - 5, 1);
  since.setHours(0, 0, 0, 0);

  const [
    { data: companies, error: companiesError },
    { data: users, error: usersError },
    { data: billingAccounts, error: billingError },
    { data: cohorts, error: cohortsError },
    { data: shifts, error: shiftsError },
    { data: exchanges, error: exchangesError },
  ] = await Promise.all([
    admin
      .from("companies")
      .select("id, name, slug, theme_config, created_at")
      .order("name"),
    admin
      .from("user_profiles")
      .select("id, full_name, email, role, company_id, validation_status, created_at")
      .order("created_at", { ascending: false }),
    admin
      .from("billing_accounts")
      .select(
        "id, owner_type, owner_user_id, owner_company_id, current_billing_state, pricing_cohort_code, billing_interval, early_access_position, trial_ends_at, price_lock_ends_at, billing_email, provider_customer_id, created_at, billing_plan:billing_plans(code, name, amount_cents, currency, billing_interval)"
      )
      .order("created_at", { ascending: false }),
    admin
      .from("billing_pricing_cohorts")
      .select("code, label, min_position, max_position, discount_label")
      .order("min_position", { ascending: true }),
    admin
      .from("shifts")
      .select("id, user_id, status, created_at")
      .gte("created_at", since.toISOString()),
    admin
      .from("exchanges")
      .select("id, user_a_id, user_b_id, status, created_at")
      .gte("created_at", since.toISOString()),
  ]);

  if (
    companiesError ||
    usersError ||
    billingError ||
    cohortsError ||
    shiftsError ||
    exchangesError
  ) {
    throw new Error("No se pudo cargar el panel de plataforma.");
  }

  const companyRows = (companies ?? []) as CompanyRow[];
  const userRows = (users ?? []) as UserRow[];
  const billingRows = (billingAccounts ?? []) as BillingAccountRow[];
  const cohortRows = (cohorts ?? []) as CohortRow[];
  const shiftRows = (shifts ?? []) as ShiftRow[];
  const exchangeRows = (exchanges ?? []) as ExchangeRow[];
  const userMap = new Map(userRows.map((profile) => [profile.id, profile]));
  const approvedUsers = userRows.filter(
    (profile) => profile.validation_status === "approved"
  );
  const pendingUsers = userRows.filter(
    (profile) => profile.validation_status === "pending"
  );
  const currentMonthKey = monthKey(new Date());
  const currentMonthShifts = shiftRows.filter(
    (shift) => monthKey(shift.created_at) === currentMonthKey
  );
  const currentMonthExchanges = exchangeRows.filter(
    (exchange) => monthKey(exchange.created_at) === currentMonthKey
  );
  const activeBillingAccounts = billingRows.filter((account) =>
    ["trialing", "active", "past_due"].includes(account.current_billing_state)
  );
  const blockedBillingAccounts = billingRows.filter(
    (account) => account.current_billing_state === "blocked"
  );
  const earlyUsed = billingRows.filter(
    (account) => account.early_access_position !== null
  ).length;
  const mrrEstimate = estimateMonthlyRevenue(billingRows);
  const shiftMonthCounts = countByMonth(shiftRows, buckets);
  const exchangeMonthCounts = countByMonth(exchangeRows, buckets);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform admin"
        title="Panel de plataforma"
        description="Control operativo y comercial para preparar la salida a produccion sin perder visibilidad."
        action={
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{USER_ROLE_LABELS[accountState.role]}</Badge>
            <Link href="/admin/users">
              <Button variant="outline">Usuarios y roles</Button>
            </Link>
          </div>
        }
      />

      <Feedback error={params.error} status={params.status} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Building2}
          label="Organizaciones"
          value={String(companyRows.length)}
          detail={`${approvedUsers.length} usuarios aprobados`}
        />
        <StatCard
          icon={Users}
          label="Usuarios"
          value={String(userRows.length)}
          detail={`${pendingUsers.length} pendientes de validar`}
        />
        <StatCard
          icon={CalendarDays}
          label="Publicaciones del mes"
          value={String(currentMonthShifts.length)}
          detail={`${shiftRows.length} en los ultimos 6 meses`}
        />
        <StatCard
          icon={Repeat}
          label="Intercambios del mes"
          value={String(currentMonthExchanges.length)}
          detail={`${exchangeRows.length} en los ultimos 6 meses`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Actividad mensual</CardTitle>
            <CardDescription>
              Publicaciones e intercambios creados en los ultimos 6 meses.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {buckets.map((bucket, index) => {
              const shiftsValue = shiftMonthCounts[index] ?? 0;
              const exchangesValue = exchangeMonthCounts[index] ?? 0;
              const maxValue = Math.max(...shiftMonthCounts, ...exchangeMonthCounts, 1);

              return (
                <div key={bucket.key} className="grid gap-2 sm:grid-cols-[90px_1fr]">
                  <p className="text-sm font-medium text-muted-foreground">
                    {bucket.label}
                  </p>
                  <div className="space-y-2">
                    <div className="grid grid-cols-[90px_1fr_42px] items-center gap-3 text-sm">
                      <span className="text-muted-foreground">Turnos</span>
                      <div className="h-2 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(shiftsValue / maxValue) * 100}%` }}
                        />
                      </div>
                      <span className="text-right font-medium">{shiftsValue}</span>
                    </div>
                    <div className="grid grid-cols-[90px_1fr_42px] items-center gap-3 text-sm">
                      <span className="text-muted-foreground">Cambios</span>
                      <div className="h-2 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${(exchangesValue / maxValue) * 100}%` }}
                        />
                      </div>
                      <span className="text-right font-medium">{exchangesValue}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Suscripciones</CardTitle>
            <CardDescription>
              Estado comercial y uso del programa early adopter.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 border-b border-border/70 pb-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Activas/trial</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {activeBillingAccounts.length}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bloqueadas</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {blockedBillingAccounts.length}
                </p>
              </div>
            </div>
            <div className="border-b border-border/70 pb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">
                  MRR estimado
                </p>
              </div>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {formatCurrency(mrrEstimate)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Se calcula con los importes comerciales configurados.
              </p>
            </div>
            <div className="space-y-2">
              {cohortRows.map((cohort) => {
                const used = billingRows.filter(
                  (account) => account.pricing_cohort_code === cohort.code
                ).length;
                const capacity = cohort.max_position
                  ? cohort.max_position - cohort.min_position + 1
                  : null;

                return (
                  <div
                    key={cohort.code}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium text-foreground">{cohort.label}</p>
                      <p className="text-muted-foreground">{cohort.discount_label}</p>
                    </div>
                    <Badge variant="outline">
                      {capacity ? `${used}/${capacity}` : `${used}+`}
                    </Badge>
                  </div>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground">
              Plazas early adopter asignadas: {earlyUsed}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organizaciones</CardTitle>
          <CardDescription>
            Usuarios, actividad mensual y estado comercial por empresa.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border/70 text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="py-3 pr-4 font-semibold">Empresa</th>
                <th className="py-3 pr-4 font-semibold">Usuarios</th>
                <th className="py-3 pr-4 font-semibold">Pendientes</th>
                <th className="py-3 pr-4 font-semibold">Turnos mes</th>
                <th className="py-3 pr-4 font-semibold">Cambios mes</th>
                <th className="py-3 pr-4 font-semibold">Color</th>
                <th className="py-3 font-semibold">Billing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {companyRows.map((company) => {
                const companyUsers = userRows.filter(
                  (profile) => profile.company_id === company.id
                );
                const companyUserIds = new Set(companyUsers.map((profile) => profile.id));
                const companyBilling = billingRows.filter((account) => {
                  if (account.owner_company_id === company.id) return true;
                  if (!account.owner_user_id) return false;
                  return companyUserIds.has(account.owner_user_id);
                });
                const companyShifts = currentMonthShifts.filter((shift) =>
                  companyUserIds.has(shift.user_id)
                ).length;
                const companyExchanges = currentMonthExchanges.filter(
                  (exchange) =>
                    companyUserIds.has(exchange.user_a_id) ||
                    companyUserIds.has(exchange.user_b_id)
                ).length;
                const commercialState =
                  companyBilling.find((account) => account.current_billing_state === "active")
                    ?.current_billing_state ??
                  companyBilling.find((account) => account.current_billing_state === "trialing")
                    ?.current_billing_state ??
                  companyBilling[0]?.current_billing_state ??
                  "inactive";
                const accentColor = getCompanyThemeAccentColor(
                  company.theme_config
                );

                return (
                  <tr key={company.id}>
                    <td className="py-4 pr-4">
                      <p className="font-medium text-foreground">{company.name}</p>
                      <p className="text-muted-foreground">{company.slug}</p>
                    </td>
                    <td className="py-4 pr-4">{companyUsers.length}</td>
                    <td className="py-4 pr-4">
                      {
                        companyUsers.filter(
                          (profile) => profile.validation_status === "pending"
                        ).length
                      }
                    </td>
                    <td className="py-4 pr-4">{companyShifts}</td>
                    <td className="py-4 pr-4">{companyExchanges}</td>
                    <td className="py-4 pr-4">
                      <span className="flex items-center gap-2">
                        <span
                          className="size-4 rounded-full border border-border"
                          style={
                            accentColor
                              ? { backgroundColor: accentColor }
                              : undefined
                          }
                        />
                        <span className="font-mono text-xs text-muted-foreground">
                          {accentColor ?? "por defecto"}
                        </span>
                      </span>
                    </td>
                    <td className="py-4">
                      <Badge variant="outline">{commercialState}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {canManageCompanyTheme ? (
            <div className="mt-5 grid gap-3">
              <div>
                <h3 className="font-semibold text-foreground">
                  Color corporativo
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Este ajuste cambia los acentos visuales del dashboard de la
                  empresa.
                </p>
              </div>
              {companyRows.map((company) => (
                <form
                  action={updatePlatformCompanyThemeAction}
                  className="grid gap-4 rounded-2xl border border-border/70 bg-secondary/25 p-4 md:grid-cols-[minmax(0,1fr)_minmax(260px,420px)_auto] md:items-end"
                  key={`platform-company-theme-${company.id}`}
                >
                  <input name="companyId" type="hidden" value={company.id} />
                  <input name="returnTo" type="hidden" value="/admin/platform" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {company.name}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {company.slug}
                    </p>
                  </div>
                  <ColorPaletteField
                    defaultValue={getCompanyThemeAccentColor(
                      company.theme_config
                    )}
                    label="Color"
                    name="accentColor"
                    paletteLabel={`Paleta de ${company.name}`}
                  />
                  <Button type="submit" variant="outline">
                    <Palette className="size-4" />
                    Guardar color
                  </Button>
                </form>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Planes contratados</CardTitle>
          <CardDescription>
            Ultimas cuentas con plan asignado, cohorte y estado de acceso.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {billingRows.slice(0, 10).map((account) => {
            const owner = account.owner_user_id
              ? userMap.get(account.owner_user_id)
              : null;
            const plan = pickRelation(account.billing_plan);

            return (
              <div
                key={account.id}
                className="grid gap-3 rounded-2xl border border-border/70 bg-background/80 p-4 lg:grid-cols-[minmax(0,1fr)_180px_160px]"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {owner?.full_name ?? account.billing_email ?? "Cuenta sin usuario"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {owner?.email ?? account.provider_customer_id ?? "Sin customer Stripe"}
                  </p>
                </div>
                <div className="text-sm">
                  <p className="font-medium text-foreground">
                    {plan?.name ?? "Sin plan asignado"}
                  </p>
                  <p className="text-muted-foreground">
                    {account.billing_interval === "year" ? "Anual" : "Mensual"}
                    {account.early_access_position
                      ? ` - #${account.early_access_position}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center lg:justify-end">
                  <Badge variant="outline">{account.current_billing_state}</Badge>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
