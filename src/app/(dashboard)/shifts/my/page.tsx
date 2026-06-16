import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Plus, Users } from "lucide-react";
import { CancelShiftButton } from "@/components/shifts/cancel-shift-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  COMPENSATION_SHIFT_TYPE_LABELS,
  EXCHANGE_AGREEMENT_LABELS,
  EXCHANGE_STATUS_LABELS,
  EXCHANGE_STATUS_STYLES,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_STYLES,
  SHIFT_STATUS_LABELS,
  SHIFT_STATUS_STYLES,
  SHIFT_TYPE_LABELS,
  SHIFT_TYPE_STYLES,
} from "@/lib/constants";
import { formatCompensationDateLabel } from "@/lib/exchange-compensation";
import { expireStaleOpenShifts } from "@/lib/stale-shifts";
import { formatShortDate, formatTimeRange } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { acceptProposal, rejectProposal } from "./actions";
import type { ExchangeAgreementType, ExchangeStatus, ShiftType } from "@/types";

interface ProposalWithUser {
  id: string;
  shift_id: string;
  interested_user_id: string;
  agreement_type: string | null;
  compensation_shift_date: string | null;
  compensation_shift_type: string | null;
  status: string;
  created_at: string;
  requester: {
    id: string;
    email: string;
    full_name: string;
  };
}

interface ShiftWithProposals {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  coverage_start_time: string | null;
  coverage_end_time: string | null;
  shift_type: string;
  direct_recipient_id: string | null;
  status: string;
  description: string | null;
  department: { id: string; name: string };
  job_position: { id: string; name: string } | null;
  shift_requests: ProposalWithUser[];
}

interface ActiveExchange {
  id: string;
  shift_id: string;
  user_b_id: string;
  status: ExchangeStatus;
  cancellation_requested_by: string | null;
  cancellation_requested_at: string | null;
  requester: {
    id: string;
    email: string;
    full_name: string;
  };
}

export default async function MyShiftsPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  await expireStaleOpenShifts({ userId: authUser.id });

  const { data: shifts } = await supabase
    .from("shifts")
    .select(
      `
      id, date, start_time, end_time, coverage_start_time, coverage_end_time,
      shift_type, direct_recipient_id, status, description,
      department:departments!department_id(id, name),
      job_position:job_positions!job_position_id(id, name),
      shift_requests(
        id, shift_id, interested_user_id, agreement_type,
        compensation_shift_date, compensation_shift_type, status, created_at,
        requester:user_profiles!interested_user_id(id, email, full_name)
      )
    `,
    )
    .eq("user_id", authUser.id)
    .order("date", { ascending: false });

  const typedShifts = (shifts ?? []) as unknown as ShiftWithProposals[];
  const shiftIds = typedShifts.map((shift) => shift.id);

  const { data: activeExchanges } =
    shiftIds.length === 0
      ? { data: [] }
      : await supabase
          .from("exchanges")
          .select(
            `
            id, shift_id, user_b_id, status,
            cancellation_requested_by, cancellation_requested_at,
            requester:user_profiles!user_b_id(id, email, full_name)
          `,
          )
          .in("shift_id", shiftIds)
          .in("status", [
            "accepted",
            "pending_validation",
            "approved",
            "completed",
          ])
          .order("created_at", { ascending: false });

  const activeExchangeByShiftId = new Map<string, ActiveExchange>();
  for (const exchange of (activeExchanges ??
    []) as unknown as ActiveExchange[]) {
    if (!activeExchangeByShiftId.has(exchange.shift_id)) {
      activeExchangeByShiftId.set(exchange.shift_id, exchange);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gestion"
        title="Mis turnos"
        description="Supervisa tus publicaciones, revisa propuestas pendientes y detecta rapido cuando un turno ya esta evolucionando hacia un intercambio."
        action={
          <Link href="/shifts/new">
            <Button>
              <Plus className="size-4" />
              Publicar turno
            </Button>
          </Link>
        }
      />

      {typedShifts.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="size-5" />}
          title="Aun no has publicado ningun turno"
          description="Cuando publiques tu primer turno podras gestionar propuestas y seguir el estado del intercambio desde aqui."
          action={
            <Link href="/shifts/new">
              <Button variant="outline">Publicar tu primer turno</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {typedShifts.map((shift) => {
            const activeExchange = activeExchangeByShiftId.get(shift.id);
            const timeRange = formatTimeRange(shift.start_time, shift.end_time);
            const coverageTimeRange =
              shift.coverage_start_time && shift.coverage_end_time
                ? formatTimeRange(
                    shift.coverage_start_time,
                    shift.coverage_end_time,
                  )
                : null;
            const detailHref = activeExchange
              ? `/exchanges/${activeExchange.id}`
              : `/shifts/${shift.id}`;
            const detailLabel = activeExchange
              ? "Ver intercambio"
              : "Ver detalle";
            const pendingProposals = shift.shift_requests.filter(
              (request) =>
                !shift.direct_recipient_id &&
                shift.status === "open" &&
                request.status === "pending" &&
                request.interested_user_id !== activeExchange?.user_b_id,
            );
            const directProposal = shift.direct_recipient_id
              ? shift.shift_requests.find(
                  (request) =>
                    request.interested_user_id === shift.direct_recipient_id,
                )
              : null;
            const hasPendingCancellationRequest =
              (activeExchange?.status === "pending_validation" ||
                activeExchange?.status === "approved") &&
              Boolean(activeExchange.cancellation_requested_by);
            const isCancellationRequester =
              hasPendingCancellationRequest &&
              activeExchange?.cancellation_requested_by === authUser.id;
            const statusLabel = activeExchange
              ? EXCHANGE_STATUS_LABELS[activeExchange.status]
              : SHIFT_STATUS_LABELS[
                  shift.status as keyof typeof SHIFT_STATUS_LABELS
                ];
            const statusClassName = activeExchange
              ? EXCHANGE_STATUS_STYLES[activeExchange.status]
              : SHIFT_STATUS_STYLES[
                  shift.status as keyof typeof SHIFT_STATUS_STYLES
                ];

            return (
              <Card key={shift.id}>
                <CardHeader className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarDays className="size-4" />
                        {formatShortDate(shift.date)} · {timeRange}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          className={
                            SHIFT_TYPE_STYLES[shift.shift_type as ShiftType]
                          }
                        >
                          {SHIFT_TYPE_LABELS[shift.shift_type as ShiftType]}
                        </Badge>
                        <Badge className={statusClassName}>{statusLabel}</Badge>
                        <Badge variant="outline" className="text-foreground">
                          {shift.department.name}
                        </Badge>
                        {shift.job_position && (
                          <Badge variant="outline" className="text-foreground">
                            {shift.job_position.name}
                          </Badge>
                        )}
                        {coverageTimeRange && (
                          <Badge variant="outline" className="text-foreground">
                            Cobertura {coverageTimeRange}
                          </Badge>
                        )}
                        {shift.direct_recipient_id && (
                          <Badge variant="outline" className="text-foreground">
                            Directa
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={detailHref}>
                        <Button variant="ghost" size="sm">
                          {detailLabel}
                        </Button>
                      </Link>
                      {!activeExchange && shift.status === "open" && (
                        <CancelShiftButton shiftId={shift.id} />
                      )}
                    </div>
                  </div>

                  {shift.description && (
                    <CardDescription>{shift.description}</CardDescription>
                  )}
                </CardHeader>

                <CardContent>
                  {activeExchange ? (
                    <div className="space-y-5">
                      <div className="rounded-2xl border border-border/70 bg-secondary/45 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                              <Users className="size-4 text-primary" />
                              Intercambio asociado
                            </div>
                            <p className="text-sm font-medium text-foreground">
                              {activeExchange.requester.full_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {activeExchange.requester.email}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge
                              className={
                                EXCHANGE_STATUS_STYLES[activeExchange.status]
                              }
                            >
                              {EXCHANGE_STATUS_LABELS[activeExchange.status]}
                            </Badge>
                            {hasPendingCancellationRequest && (
                              <Badge variant="outline">
                                Cancelacion pendiente
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="mt-4 text-sm leading-6 text-muted-foreground">
                          {hasPendingCancellationRequest ? (
                            isCancellationRequester ? (
                              <>
                                Ya has solicitado la cancelacion. Queda
                                pendiente de respuesta por la otra parte.
                              </>
                            ) : (
                              <>
                                La otra parte ha solicitado cancelar este
                                intercambio. Entra en el intercambio para
                                confirmarlo o rechazarlo.
                              </>
                            )
                          ) : activeExchange.status === "accepted" ? (
                            <>
                              Propuesta aceptada. Cuando la otra parte firme, el
                              intercambio quedara aceptado por ambas partes.
                            </>
                          ) : (
                            <>
                              Este caso ya se gestiona como intercambio. Usa la
                              vista de detalle para consultar el estado y las
                              acciones disponibles.
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  ) : shift.direct_recipient_id ? (
                    <div className="rounded-2xl border border-border/70 bg-secondary/45 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <Users className="size-4 text-primary" />
                            Propuesta directa enviada
                          </div>
                          <p className="text-sm font-medium text-foreground">
                            {directProposal?.requester.full_name ??
                              "Destinatario"}
                          </p>
                          {directProposal?.requester.email && (
                            <p className="text-sm text-muted-foreground">
                              {directProposal.requester.email}
                            </p>
                          )}
                        </div>
                        {directProposal && (
                          <Badge
                            className={
                              REQUEST_STATUS_STYLES[
                                directProposal.status as keyof typeof REQUEST_STATUS_STYLES
                              ]
                            }
                          >
                            {
                              REQUEST_STATUS_LABELS[
                                directProposal.status as keyof typeof REQUEST_STATUS_LABELS
                              ]
                            }
                          </Badge>
                        )}
                      </div>
                      <p className="mt-4 text-sm leading-6 text-muted-foreground">
                        {directProposal?.status === "pending"
                          ? "Esta propuesta no aparece en el tablon. Queda pendiente de respuesta por la persona destinataria."
                          : "Esta propuesta directa ya no admite acciones desde aqui."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Users className="size-4 text-primary" />
                        Propuestas ({pendingProposals.length})
                      </div>

                      {pendingProposals.length === 0 ? (
                        <p className="rounded-2xl border border-dashed border-border/80 bg-secondary/35 px-4 py-6 text-sm text-muted-foreground">
                          {shift.status === "open"
                            ? "Todavia nadie ha propuesto por este turno."
                            : "Esta publicacion ya esta cerrada y no admite mas propuestas."}
                        </p>
                      ) : (
                        <ul className="space-y-3">
                          {pendingProposals.map((proposal) => {
                            const isInvalidRestProposal =
                              proposal.agreement_type === "shift_exchange" &&
                              (!proposal.compensation_shift_type ||
                                proposal.compensation_shift_type === "rest");

                            return (
                              <li
                                key={proposal.id}
                                className="rounded-2xl border border-border/75 bg-background/90 px-4 py-4"
                              >
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                  <div className="min-w-0 space-y-1">
                                    <p className="truncate text-sm font-semibold text-foreground">
                                      {proposal.requester.full_name}
                                    </p>
                                    <p className="truncate text-sm text-muted-foreground">
                                      {proposal.requester.email}
                                    </p>
                                    {proposal.agreement_type && (
                                      <p className="text-xs text-muted-foreground">
                                        {
                                          EXCHANGE_AGREEMENT_LABELS[
                                            proposal.agreement_type as ExchangeAgreementType
                                          ]
                                        }
                                        {proposal.agreement_type ===
                                          "hours_bank" &&
                                          coverageTimeRange && (
                                            <> {" - "}Cobertura {coverageTimeRange}</>
                                          )}
                                        {proposal.agreement_type ===
                                          "shift_exchange" &&
                                          proposal.compensation_shift_date && (
                                            <>
                                              {" — "}
                                              {proposal.compensation_shift_type
                                                ? COMPENSATION_SHIFT_TYPE_LABELS[
                                                    proposal.compensation_shift_type as
                                                      | ShiftType
                                                      | "rest"
                                                  ]
                                                : "Pendiente"}{" "}
                                              del{" "}
                                              {formatCompensationDateLabel(
                                                proposal.compensation_shift_date,
                                              )}
                                            </>
                                          )}
                                      </p>
                                    )}
                                    {isInvalidRestProposal && (
                                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                                        Esta propuesta no es aceptable porque
                                        ofrece un descanso.
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <form action={acceptProposal}>
                                      <input
                                        type="hidden"
                                        name="request_id"
                                        value={proposal.id}
                                      />
                                      <input
                                        type="hidden"
                                        name="shift_id"
                                        value={shift.id}
                                      />
                                      <Button
                                        type="submit"
                                        size="sm"
                                        disabled={isInvalidRestProposal}
                                      >
                                        Aceptar
                                      </Button>
                                    </form>
                                    <form action={rejectProposal}>
                                      <input
                                        type="hidden"
                                        name="request_id"
                                        value={proposal.id}
                                      />
                                      <input
                                        type="hidden"
                                        name="shift_id"
                                        value={shift.id}
                                      />
                                      <Button
                                        type="submit"
                                        size="sm"
                                        variant="outline"
                                      >
                                        Rechazar
                                      </Button>
                                    </form>
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
