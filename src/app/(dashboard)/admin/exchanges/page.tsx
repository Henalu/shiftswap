import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, ClipboardCheck, FileSearch, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  canReviewExchange,
  getAuthenticatedExchangeActor,
} from "@/lib/exchange-workflow";
import {
  EXCHANGE_STATUS_LABELS,
  EXCHANGE_STATUS_STYLES,
  SHIFT_TYPE_LABELS,
  SHIFT_TYPE_STYLES,
} from "@/lib/constants";
import { pickFirstRelation } from "@/lib/supabase-relations";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatShortDate, formatTimeRange } from "@/lib/utils";
import { USER_ROLE_LABELS } from "@/lib/user-roles";
import type { ExchangeAgreementType, ExchangeStatus, ShiftType } from "@/types";

interface ApprovalExchangeRow {
  id: string;
  shift_id: string;
  status: ExchangeStatus;
  agreement_type: ExchangeAgreementType | null;
  coverage_start_time: string | null;
  coverage_end_time: string | null;
  submitted_for_approval_at: string | null;
  approved_at: string | null;
  department_reviewed_at: string | null;
  department_decision_notes: string | null;
  signed_by_user_a_at: string | null;
  signed_by_user_b_at: string | null;
  user_a_id: string;
  user_b_id: string;
  owner: { id: string; full_name: string };
  requester: { id: string; full_name: string };
  shift: {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    shift_type: string;
    department: {
      id: string;
      name: string;
      company_id: string;
    };
  };
}

function getCoverageTimeRange(exchange: ApprovalExchangeRow): string | null {
  if (
    exchange.agreement_type !== "hours_bank" ||
    !exchange.coverage_start_time ||
    !exchange.coverage_end_time
  ) {
    return null;
  }

  return formatTimeRange(exchange.coverage_start_time, exchange.coverage_end_time);
}

function CoverageBadge({ timeRange }: { timeRange: string | null }) {
  if (!timeRange) {
    return null;
  }

  return (
    <Badge variant="outline" className="text-foreground">
      Cobertura {timeRange}
    </Badge>
  );
}

export default async function AdminExchangesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const actor = await getAuthenticatedExchangeActor(user.id);
  if (!actor) {
    redirect("/shifts");
  }

  const adminClient = createAdminClient();
  const { data: exchanges, error } = await adminClient
    .from("exchanges")
    .select(
      `
      id, shift_id, status, agreement_type, coverage_start_time, coverage_end_time,
      submitted_for_approval_at, approved_at, department_reviewed_at,
      department_decision_notes, signed_by_user_a_at, signed_by_user_b_at,
      user_a_id, user_b_id,
      owner:user_profiles!user_a_id(id, full_name),
      requester:user_profiles!user_b_id(id, full_name),
      shift:shifts!shift_id(
        id,
        date,
        start_time,
        end_time,
        shift_type,
        department:departments!department_id(id, name, company_id)
      )
    `
    )
    .in("status", ["pending_validation", "approved", "rejected"])
    .order("approved_at", { ascending: false, nullsFirst: false })
    .order("submitted_for_approval_at", { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error("No se pudieron cargar los cambios informados.");
  }

  const normalizedExchanges = ((exchanges ?? []) as unknown[]).map((exchange) => {
    const typed = exchange as unknown as ApprovalExchangeRow & {
      owner: ApprovalExchangeRow["owner"] | ApprovalExchangeRow["owner"][];
      requester:
        | ApprovalExchangeRow["requester"]
        | ApprovalExchangeRow["requester"][];
      shift:
        | (ApprovalExchangeRow["shift"] & {
            department:
              | ApprovalExchangeRow["shift"]["department"]
              | ApprovalExchangeRow["shift"]["department"][];
          })
        | ApprovalExchangeRow["shift"][];
    };
    const shift = pickFirstRelation(typed.shift);

    return {
      ...typed,
      owner: pickFirstRelation(typed.owner),
      requester: pickFirstRelation(typed.requester),
      shift: shift
        ? {
            ...shift,
            department: pickFirstRelation(shift.department) ?? shift.department,
          }
        : null,
    };
  });

  const scopedExchanges = normalizedExchanges.filter(
    (
      exchange
    ): exchange is ApprovalExchangeRow =>
      Boolean(exchange.owner) &&
      Boolean(exchange.requester) &&
      Boolean(exchange.shift) &&
      exchange.user_a_id !== actor.id &&
      exchange.user_b_id !== actor.id &&
      canReviewExchange(actor, {
        user_a_id: exchange.user_a_id,
        user_b_id: exchange.user_b_id,
        company_id: exchange.shift!.department.company_id,
        department_id: exchange.shift!.department.id,
      })
  );

  const informedExchanges = scopedExchanges.filter(
    (exchange) => exchange.status === "approved"
  );
  const resolvedExchanges = scopedExchanges
    .filter(
      (exchange) =>
        exchange.status === "pending_validation" || exchange.status === "rejected"
    )
    .slice(0, 8);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Administracion"
        title="Cambios informados"
        description="Consulta los intercambios aceptados por ambas partes dentro de tu alcance. No requieren aprobacion adicional."
        action={
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{USER_ROLE_LABELS[actor.role]}</Badge>
            <Link href="/admin/validations">
              <Button variant="outline">Validaciones</Button>
            </Link>
          </div>
        }
      />

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
            Cambios aceptados por ambas partes
          </h2>
          <p className="text-sm text-muted-foreground">
            Revisa rapidamente los cambios que el equipo ya ha aceptado y que
            quedan informados para seguimiento.
          </p>
        </div>

        {informedExchanges.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="size-5" />}
            title="No hay cambios informados"
            description="Cuando dos usuarios firmen un intercambio, aparecera aqui como aceptado por ambas partes."
          />
        ) : (
          <div className="space-y-4">
            {informedExchanges.map((exchange) => {
              const timeRange = formatTimeRange(
                exchange.shift.start_time,
                exchange.shift.end_time
              );
              const coverageTimeRange = getCoverageTimeRange(exchange);

              return (
                <Card key={exchange.id}>
                  <CardHeader className="space-y-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <Badge className={EXCHANGE_STATUS_STYLES[exchange.status]}>
                            {EXCHANGE_STATUS_LABELS[exchange.status]}
                          </Badge>
                          <Badge
                            className={
                              SHIFT_TYPE_STYLES[exchange.shift.shift_type as ShiftType]
                            }
                          >
                            {SHIFT_TYPE_LABELS[exchange.shift.shift_type as ShiftType]}
                          </Badge>
                          <Badge variant="outline" className="text-foreground">
                            {exchange.shift.department.name}
                          </Badge>
                          <CoverageBadge timeRange={coverageTimeRange} />
                        </div>

                        <div className="space-y-1">
                          <CardTitle className="text-[1.55rem]">
                            {formatShortDate(exchange.shift.date)} · {timeRange}
                          </CardTitle>
                          <CardDescription>
                            {exchange.owner.full_name} y {exchange.requester.full_name}
                          </CardDescription>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          Firmas completas
                        </Badge>
                        {exchange.approved_at && (
                          <Badge variant="outline">
                            Aceptado {formatShortDate(exchange.approved_at)}
                          </Badge>
                        )}
                        <Link href={`/exchanges/${exchange.id}`}>
                          <Button>
                            <FileSearch className="size-4" />
                            Ver expediente
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-border/75 bg-secondary/35 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Propietario
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {exchange.owner.full_name}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/75 bg-secondary/35 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Solicitante
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {exchange.requester.full_name}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/75 bg-secondary/35 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Firma 1
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {exchange.signed_by_user_a_at
                          ? formatShortDate(exchange.signed_by_user_a_at)
                          : "Pendiente"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/75 bg-secondary/35 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Firma 2
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {exchange.signed_by_user_b_at
                          ? formatShortDate(exchange.signed_by_user_b_at)
                          : "Pendiente"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {resolvedExchanges.length > 0 && (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
              Expedientes anteriores
            </h2>
            <p className="text-sm text-muted-foreground">
              Estados heredados del flujo anterior o expedientes rechazados.
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {resolvedExchanges.map((exchange) => (
              <Card key={exchange.id}>
                <CardContent className="space-y-4 pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap gap-2">
                        <Badge className={EXCHANGE_STATUS_STYLES[exchange.status]}>
                          {EXCHANGE_STATUS_LABELS[exchange.status]}
                        </Badge>
                        <Badge variant="outline" className="text-foreground">
                          {exchange.shift.department.name}
                        </Badge>
                        <CoverageBadge timeRange={getCoverageTimeRange(exchange)} />
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        {exchange.owner.full_name} · {exchange.requester.full_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatShortDate(exchange.shift.date)} ·{" "}
                        {formatTimeRange(
                          exchange.shift.start_time,
                          exchange.shift.end_time
                        )}
                      </p>
                    </div>

                    <div
                      className={
                        exchange.status === "rejected"
                          ? "rounded-xl bg-rose-500/10 p-2 text-rose-700"
                          : exchange.status === "approved"
                          ? "rounded-xl bg-emerald-500/10 p-2 text-emerald-700"
                          : "rounded-xl bg-amber-500/10 p-2 text-amber-700"
                      }
                    >
                      {exchange.status === "rejected" ? (
                        <XCircle className="size-4" />
                      ) : exchange.status === "approved" ? (
                        <CheckCircle2 className="size-4" />
                      ) : (
                        <ClipboardCheck className="size-4" />
                      )}
                    </div>
                  </div>

                  {exchange.department_decision_notes && (
                    <p className="rounded-2xl border border-border/75 bg-secondary/35 px-4 py-4 text-sm leading-6 text-muted-foreground">
                      {exchange.department_decision_notes}
                    </p>
                  )}

                  <Link href={`/exchanges/${exchange.id}`}>
                    <Button variant="ghost" size="sm">
                      Ver expediente
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
