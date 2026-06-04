import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowLeftRight,
  FileText,
  MessageSquare,
  ShieldCheck,
  User,
} from "lucide-react";
import { ExchangeWorkflowProgress } from "@/components/exchanges/exchange-workflow-progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { startConversation } from "@/app/(dashboard)/chat/actions";
import {
  formatCompensationDateLabel,
  getMadridDateInputValue,
  getAgreementSummary,
} from "@/lib/exchange-compensation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  canAccessExchange,
  canReviewExchange,
  EXCHANGE_CAN_CHAT_STATUSES,
  EXCHANGE_EXPORTABLE_STATUSES,
  getAuthenticatedExchangeActor,
} from "@/lib/exchange-workflow";
import {
  EXCHANGE_AGREEMENT_LABELS,
  EXCHANGE_AGREEMENT_STYLES,
  EXCHANGE_STATUS_LABELS,
  EXCHANGE_STATUS_STYLES,
  COMPENSATION_SHIFT_TYPE_LABELS,
  SHIFT_DEBT_TRANSACTION_STATUS_LABELS,
  SHIFT_DEBT_TRANSACTION_STATUS_STYLES,
  SHIFT_TYPE_LABELS,
  SHIFT_TYPE_STYLES,
} from "@/lib/constants";
import { pickFirstRelation } from "@/lib/supabase-relations";
import {
  formatDate,
  formatShortDate,
  formatTime,
  formatTimeRange,
} from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import {
  cancelExchange,
  confirmSignedExchangeCancellation,
  rejectSignedExchangeCancellation,
  requestSignedExchangeCancellation,
  signAsInterested,
} from "../actions";
import type {
  ExchangeAgreementType,
  ExchangeEvent,
  ExchangeStatus,
  ShiftDebtTransactionStatus,
  ShiftType,
} from "@/types";

interface ExchangeDetail {
  id: string;
  shift_id: string;
  user_a_id: string;
  user_b_id: string;
  status: ExchangeStatus;
  agreement_type: ExchangeAgreementType | null;
  compensation_shift_date: string | null;
  compensation_shift_type: ShiftType | "rest" | null;
  document_url: string | null;
  confirmed_at: string | null;
  signed_by_user_a_at: string | null;
  signed_by_user_b_at: string | null;
  signed_by_user_a_name: string | null;
  signed_by_user_b_name: string | null;
  submitted_for_approval_at: string | null;
  department_approver_id: string | null;
  department_reviewed_at: string | null;
  department_decision_notes: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  cancellation_requested_by: string | null;
  cancellation_requested_at: string | null;
  created_at: string;
  shift: {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    shift_type: string;
    department: { id: string; name: string; company_id: string };
  };
  owner: { id: string; full_name: string; email: string };
  requester: { id: string; full_name: string; email: string };
  departmentApprover: { id: string; full_name: string; email: string } | null;
}

interface ShiftDebtTransactionRow {
  id: string;
  status: ShiftDebtTransactionStatus;
  units: number;
  debtor_user_id: string;
  creditor_user_id: string;
  created_at: string;
}

interface ExchangeEventRow extends ExchangeEvent {
  actor: { id: string; full_name: string } | null;
}

function getFirstExchangeDate(
  shiftDate: string,
  compensationShiftDate: string | null,
): string {
  if (!compensationShiftDate) {
    return shiftDate;
  }

  return compensationShiftDate < shiftDate ? compensationShiftDate : shiftDate;
}

async function signAsInterestedAction(formData: FormData): Promise<void> {
  "use server";

  await signAsInterested(formData);
}

function renderStatusSummary(
  exchange: ExchangeDetail
) {
  if (exchange.status === "accepted") {
    return (
      <>
        La propuesta ha sido aceptada. Falta que{" "}
        <strong>{exchange.requester.full_name}</strong> firme la solicitud para
        cerrar el intercambio dentro de la app.
      </>
    );
  }

  if (exchange.status === "pending_validation") {
    if (exchange.cancellation_requested_by) {
      return (
        <>
          Hay una retirada pendiente entre participantes. El expediente queda
          detenido hasta que la otra parte confirme o rechace esa retirada.
        </>
      );
    }

    return (
      <>
        Las firmas ya estan registradas. Este expediente quedo en un estado
        antiguo y debe normalizarse automaticamente a aceptado por ambas partes.
      </>
    );
  }

  if (exchange.status === "approved") {
    return (
      <>
        El intercambio ha sido aceptado por ambas partes. La app informa al
        responsable correspondiente, pero no necesita aprobacion adicional.
      </>
    );
  }

  if (exchange.status === "rejected") {
    return (
      <>
        Este expediente fue rechazado en el flujo anterior. El turno vuelve a
        quedar disponible y puedes revisar las observaciones para decidir el
        siguiente paso.
      </>
    );
  }

  if (exchange.status === "cancelled") {
    return (
      <>
        Este expediente se ha cancelado antes de cerrarse. El turno puede volver
        a negociarse si sigue interesando a las partes.
      </>
    );
  }

  return <>Este expediente ya no requiere nuevas acciones.</>;
}

export default async function ExchangeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/login");

  const actor = await getAuthenticatedExchangeActor(authUser.id);
  if (!actor) redirect("/shifts");

  const adminClient = createAdminClient();
  const [{ data: exchange }, { data: events }, { data: debtTransaction }] =
    await Promise.all([
    adminClient
      .from("exchanges")
      .select(
        `
        id, shift_id, user_a_id, user_b_id, status, agreement_type,
        compensation_shift_date, compensation_shift_type, document_url, confirmed_at,
        signed_by_user_a_at, signed_by_user_b_at,
        signed_by_user_a_name, signed_by_user_b_name,
        submitted_for_approval_at,
        department_approver_id, department_reviewed_at, department_decision_notes,
        approved_at, rejected_at,
        cancellation_requested_by, cancellation_requested_at, created_at,
        shift:shifts!shift_id(
          id,
          date,
          start_time,
          end_time,
          shift_type,
          department:departments!department_id(id, name, company_id)
        ),
        owner:user_profiles!user_a_id(id, full_name, email),
        requester:user_profiles!user_b_id(id, full_name, email),
        departmentApprover:user_profiles!department_approver_id(id, full_name, email)
      `
      )
      .eq("id", id)
      .maybeSingle(),
    adminClient
      .from("exchange_events")
      .select(
        `
        id, exchange_id, actor_id, event_type, from_status, to_status, title, details, metadata, created_at,
        actor:user_profiles!actor_id(id, full_name)
      `
      )
      .eq("exchange_id", id)
      .order("created_at", { ascending: false }),
    adminClient
      .from("shift_debt_transactions")
      .select("id, status, units, debtor_user_id, creditor_user_id, created_at")
      .eq("exchange_id", id)
      .maybeSingle(),
  ]);

  if (!exchange) {
    notFound();
  }

  const rawExchange = exchange as unknown as ExchangeDetail & {
    shift:
      | (ExchangeDetail["shift"] & {
          department:
            | ExchangeDetail["shift"]["department"]
            | ExchangeDetail["shift"]["department"][];
        })
      | ExchangeDetail["shift"][];
    owner: ExchangeDetail["owner"] | ExchangeDetail["owner"][];
    requester: ExchangeDetail["requester"] | ExchangeDetail["requester"][];
    departmentApprover:
      | ExchangeDetail["departmentApprover"]
      | ExchangeDetail["departmentApprover"][];
  };
  const shift = pickFirstRelation(rawExchange.shift);
  const typed = {
    ...rawExchange,
    shift: shift
      ? {
          ...shift,
          department: pickFirstRelation(shift.department) ?? shift.department,
        }
      : null,
    owner: pickFirstRelation(rawExchange.owner),
    requester: pickFirstRelation(rawExchange.requester),
    departmentApprover: pickFirstRelation(rawExchange.departmentApprover),
  } as ExchangeDetail;

  if (!typed.shift || !typed.owner || !typed.requester) {
    notFound();
  }
  const canViewExchange = canAccessExchange(actor, {
    user_a_id: typed.user_a_id,
    user_b_id: typed.user_b_id,
    company_id: typed.shift.department.company_id,
    department_id: typed.shift.department.id,
  });

  if (!canViewExchange) {
    notFound();
  }

  const now = new Date().toISOString();

  await supabase
    .from("notifications")
    .update({ read: true, read_at: now })
    .eq("user_id", authUser.id)
    .eq("read", false)
    .contains("data", { exchange_id: id });

  const typedEvents = ((events ?? []) as unknown[]).map((event) => {
    const typedEvent = event as unknown as ExchangeEventRow & {
      actor: ExchangeEventRow["actor"] | ExchangeEventRow["actor"][];
    };

    return {
      ...typedEvent,
      actor: pickFirstRelation(typedEvent.actor),
    };
  });
  const typedDebtTransaction = (debtTransaction as ShiftDebtTransactionRow | null) ?? null;
  const isOwner = typed.user_a_id === authUser.id;
  const isRequester = typed.user_b_id === authUser.id;
  const isParticipant = isOwner || isRequester;
  const isApproverReviewer =
    !isParticipant &&
    canReviewExchange(actor, {
      user_a_id: typed.user_a_id,
      user_b_id: typed.user_b_id,
      company_id: typed.shift.department.company_id,
      department_id: typed.shift.department.id,
    });
  const otherUser = isOwner ? typed.requester : typed.owner;
  const hasPendingCancellationRequest =
    (typed.status === "pending_validation" || typed.status === "approved") &&
    Boolean(typed.cancellation_requested_by);
  const isCancellationRequester =
    hasPendingCancellationRequest && typed.cancellation_requested_by === authUser.id;
  const canCancelBeforeFirstDate =
    isParticipant &&
    ["accepted", "pending_validation", "approved"].includes(typed.status) &&
    getMadridDateInputValue() <
      getFirstExchangeDate(typed.shift.date, typed.compensation_shift_date);
  const canRequestFormalCancellation =
    isParticipant &&
    (typed.status === "pending_validation" || typed.status === "approved") &&
    !hasPendingCancellationRequest &&
    canCancelBeforeFirstDate;
  const canRespondToFormalCancellation =
    isParticipant &&
    (typed.status === "pending_validation" || typed.status === "approved") &&
    hasPendingCancellationRequest &&
    !isCancellationRequester &&
    canCancelBeforeFirstDate;
  const canCancelDirectly =
    isParticipant && typed.status === "accepted" && canCancelBeforeFirstDate;
  const canOpenChat =
    isParticipant && EXCHANGE_CAN_CHAT_STATUSES.includes(typed.status);
  const canSign =
    typed.status === "accepted" && isRequester && !typed.signed_by_user_b_at;
  const timeRange = formatTimeRange(typed.shift.start_time, typed.shift.end_time);
  const showExportButton = EXCHANGE_EXPORTABLE_STATUSES.includes(typed.status);
  const agreementSummary = getAgreementSummary({
    agreementType: typed.agreement_type,
    compensationShiftType: typed.compensation_shift_type,
    compensationShiftDate: typed.compensation_shift_date,
    ownerName: typed.owner.full_name,
    requesterName: typed.requester.full_name,
  });
  const compensationDateLabel = formatCompensationDateLabel(
    typed.compensation_shift_date
  );

  const renderSignatureStatus = ({
    label,
    signedAt,
    signedName,
    canCurrentUserSign,
    extraContent,
  }: {
    label: string;
    signedAt: string | null;
    signedName: string | null;
    canCurrentUserSign: boolean;
    extraContent?: ReactNode;
  }) => {
    return (
      <div className="rounded-2xl border border-border/70 bg-secondary/35 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{label}</p>
            {signedAt ? (
              <>
                <p className="text-sm text-foreground">
                  {signedName ?? "Firma registrada"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatShortDate(signedAt)} · {formatTime(signedAt)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aun no se ha firmado esta parte de la solicitud.
              </p>
            )}
          </div>

          {signedAt ? (
            <Badge className="border-emerald-500/15 bg-emerald-500/10 text-emerald-700">
              Firmado
            </Badge>
          ) : canCurrentUserSign ? (
            <form action={signAsInterestedAction}>
              <input type="hidden" name="exchange_id" value={typed.id} />
              <Button type="submit" size="sm">
                Firmar solicitud
              </Button>
            </form>
          ) : (
            <Badge variant="outline">Pendiente</Badge>
          )}
        </div>

        {extraContent ? (
          <div className="mt-4 border-t border-border/60 pt-4">{extraContent}</div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Intercambio"
        title="Expediente del cambio"
        description="Consulta el acuerdo, revisa firmas, sigue el historial y comprueba si el responsable ya fue informado."
        action={
          <Link href={isApproverReviewer ? "/admin/exchanges" : "/exchanges"}>
            <Button variant="ghost">
              <ArrowLeft className="size-4" />
              Volver
            </Button>
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
        <Card>
          <CardHeader className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={EXCHANGE_STATUS_STYLES[typed.status]}>
                {EXCHANGE_STATUS_LABELS[typed.status]}
              </Badge>
              <Badge className={SHIFT_TYPE_STYLES[typed.shift.shift_type as ShiftType]}>
                {SHIFT_TYPE_LABELS[typed.shift.shift_type as ShiftType]}
              </Badge>
              <Badge variant="outline" className="text-foreground">
                {typed.shift.department.name}
              </Badge>
              {isApproverReviewer && (
                <Badge variant="outline">
                  <ShieldCheck className="size-3.5" />
                  Responsable informado
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <CardTitle className="text-[1.85rem]">{timeRange}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {formatDate(typed.shift.date)}
              </p>
            </div>

            <ExchangeWorkflowProgress status={typed.status} />
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="rounded-2xl border border-border/70 bg-background/90 px-4 py-4 text-sm leading-6 text-muted-foreground">
              {renderStatusSummary(
                typed
              )}
            </div>

            <div className="rounded-2xl border border-border/70 bg-secondary/35 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    Compensacion acordada
                  </p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {agreementSummary}
                  </p>
                </div>

                {typed.agreement_type ? (
                  <Badge className={EXCHANGE_AGREEMENT_STYLES[typed.agreement_type]}>
                    {EXCHANGE_AGREEMENT_LABELS[typed.agreement_type]}
                  </Badge>
                ) : (
                  <Badge variant="outline">Pendiente de definir</Badge>
                )}
              </div>

              {typed.agreement_type === "shift_exchange" && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 bg-background/90 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Fecha de compensacion
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {compensationDateLabel ?? "Pendiente"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-background/90 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Compensacion futura acordada
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {typed.compensation_shift_type
                        ? COMPENSATION_SHIFT_TYPE_LABELS[typed.compensation_shift_type]
                        : "Pendiente"}
                    </p>
                  </div>
                </div>
              )}

              {typed.agreement_type === "hours_bank" && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {typedDebtTransaction ? (
                    <>
                      <Badge
                        className={
                          SHIFT_DEBT_TRANSACTION_STATUS_STYLES[
                            typedDebtTransaction.status
                          ]
                        }
                      >
                        {
                          SHIFT_DEBT_TRANSACTION_STATUS_LABELS[
                            typedDebtTransaction.status
                          ]
                        }
                      </Badge>
                      <p className="text-sm text-muted-foreground">
                        Se ha registrado una deuda de {typedDebtTransaction.units}{" "}
                        turno de {typed.owner.full_name} hacia{" "}
                        {typed.requester.full_name}.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      La deuda de 1 turno quedara registrada en el ledger cuando
                      ambas partes firmen el acuerdo.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ArrowLeftRight className="size-4 text-primary" />
                Personas implicadas
              </div>

              <div className="grid gap-3">
                <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-secondary/45 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-background text-primary">
                      <User className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {typed.owner.full_name}
                        {isOwner && (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            (tu)
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {typed.owner.email} · Propietario del turno
                      </p>
                    </div>
                  </div>
                  {typed.signed_by_user_a_at ? (
                    <Badge className="border-emerald-500/15 bg-emerald-500/10 text-emerald-700">
                      Firmado
                    </Badge>
                  ) : (
                    <Badge variant="outline">Pendiente</Badge>
                  )}
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-secondary/45 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-background text-primary">
                      <User className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {typed.requester.full_name}
                        {isRequester && (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            (tu)
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {typed.requester.email} · Solicitante
                      </p>
                    </div>
                  </div>
                  {typed.signed_by_user_b_at ? (
                    <Badge className="border-emerald-500/15 bg-emerald-500/10 text-emerald-700">
                      Firmado
                    </Badge>
                  ) : (
                    <Badge variant="outline">Pendiente</Badge>
                  )}
                </div>

                {typed.status === "rejected" &&
                  typed.departmentApprover && (
                    <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-secondary/45 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-background text-primary">
                          <ShieldCheck className="size-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {typed.departmentApprover.full_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {typed.departmentApprover.email} · Responsable que resolvio
                          </p>
                        </div>
                      </div>
                      <Badge className={EXCHANGE_STATUS_STYLES[typed.status]}>
                        {EXCHANGE_STATUS_LABELS[typed.status]}
                      </Badge>
                    </div>
                  )}
              </div>
            </div>

            {typed.status === "rejected" &&
              typed.department_decision_notes && (
                <div className="rounded-2xl border border-border/70 bg-secondary/35 px-4 py-4 text-sm leading-6 text-muted-foreground">
                  <p className="mb-2 text-sm font-semibold text-foreground">
                    Observaciones del flujo anterior
                  </p>
                  {typed.department_decision_notes}
                </div>
              )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Acciones disponibles</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {canOpenChat && (
                <form action={startConversation}>
                  <input type="hidden" name="shift_id" value={typed.shift_id} />
                  <input type="hidden" name="other_user_id" value={otherUser.id} />
                  <Button type="submit" variant="secondary">
                    <MessageSquare className="size-4" />
                    Ir al chat
                  </Button>
                </form>
              )}

              {showExportButton && (
                <a href={`/api/exchanges/${typed.id}/pdf`} download>
                  <Button variant="outline">
                    <FileText className="size-4" />
                    Descargar PDF ShiftSwap
                  </Button>
                </a>
              )}

              {showExportButton && (
                <a href={`/api/exchanges/${typed.id}/official-pdf`} download>
                  <Button variant="outline">
                    <FileText className="size-4" />
                    Descargar PDF oficial
                  </Button>
                </a>
              )}

              {canCancelDirectly && (
                <form action={cancelExchange}>
                  <input type="hidden" name="exchange_id" value={typed.id} />
                  <Button type="submit" variant="outline">
                    Cancelar expediente
                  </Button>
                </form>
              )}

              {canRequestFormalCancellation && (
                <form action={requestSignedExchangeCancellation}>
                  <input type="hidden" name="exchange_id" value={typed.id} />
                  <Button type="submit" variant="outline">
                    Solicitar retirada
                  </Button>
                </form>
              )}

              {hasPendingCancellationRequest && isCancellationRequester && (
                <Button type="button" variant="outline" disabled>
                  Retirada solicitada
                </Button>
              )}

              {canRespondToFormalCancellation && (
                <>
                  <form action={confirmSignedExchangeCancellation}>
                    <input type="hidden" name="exchange_id" value={typed.id} />
                    <Button type="submit" variant="outline">
                      Confirmar retirada
                    </Button>
                  </form>
                  <form action={rejectSignedExchangeCancellation}>
                    <input type="hidden" name="exchange_id" value={typed.id} />
                    <Button type="submit" variant="ghost">
                      Mantener solicitud
                    </Button>
                  </form>
                </>
              )}

              {isParticipant &&
                ["accepted", "pending_validation", "approved"].includes(
                  typed.status,
                ) &&
                !canCancelBeforeFirstDate && (
                  <p className="text-sm leading-6 text-muted-foreground">
                    Ya no puede cancelarse este acuerdo porque ha llegado la
                    primera fecha implicada en el intercambio.
                  </p>
                )}
            </CardContent>
          </Card>

          {typed.status === "accepted" && isParticipant && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Firma de la solicitud</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-6 text-muted-foreground">
                  La firma del propietario queda registrada al aceptar la
                  propuesta. Solo falta la firma del solicitante para cerrar el
                  intercambio como aceptado por ambas partes.
                </p>

                {renderSignatureStatus({
                  label: typed.owner.full_name,
                  signedAt: typed.signed_by_user_a_at,
                  signedName: typed.signed_by_user_a_name,
                  canCurrentUserSign: false,
                })}

                {renderSignatureStatus({
                  label: typed.requester.full_name,
                  signedAt: typed.signed_by_user_b_at,
                  signedName: typed.signed_by_user_b_name,
                  canCurrentUserSign: canSign,
                  extraContent: typed.agreement_type ? (
                    <div className="rounded-2xl border border-border/70 bg-background/90 px-4 py-4 text-sm leading-6 text-muted-foreground">
                      {agreementSummary}
                    </div>
                  ) : undefined,
                })}
              </CardContent>
            </Card>
          )}

          {typed.status === "pending_validation" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Estado antiguo pendiente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-6 text-muted-foreground">
                  Esta solicitud ya tiene las firmas necesarias. El nuevo flujo
                  no requiere aprobacion del responsable; una migracion la deja
                  como aceptada por ambas partes.
                </p>

                <div className="rounded-2xl border border-border/70 bg-secondary/35 px-4 py-4 text-sm leading-6 text-muted-foreground">
                  No hay acciones de aprobacion disponibles para este expediente.
                </div>
              </CardContent>
            </Card>
          )}

          {typed.document_url && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Soporte adicional</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm leading-6 text-muted-foreground">
                  Este expediente incluye un documento externo de apoyo. El
                  PDF visual de ShiftSwap y el PDF oficial de Cambio de Turno se
                  generan aparte a partir de los datos del expediente dentro de
                  la app.
                </p>
                <a href={typed.document_url} target="_blank" rel="noreferrer">
                  <Button variant="outline">
                    <FileText className="size-4" />
                    Abrir documento adjunto
                  </Button>
                </a>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial del expediente</CardTitle>
        </CardHeader>
        <CardContent>
          {typedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aun no hay eventos registrados para este intercambio.
            </p>
          ) : (
            <div className="space-y-3">
              {typedEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-2xl border border-border/75 bg-background/90 px-4 py-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        {event.title}
                      </p>
                      {event.details && (
                        <p className="text-sm leading-6 text-muted-foreground">
                          {event.details}
                        </p>
                      )}
                      {event.actor && (
                        <p className="text-xs text-muted-foreground">
                          Por {event.actor.full_name}
                        </p>
                      )}
                    </div>

                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatShortDate(event.created_at)} · {formatTime(event.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
