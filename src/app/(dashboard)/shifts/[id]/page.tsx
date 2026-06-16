import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MessageSquare, Users } from "lucide-react";
import { ProposeExchangeDialog } from "@/components/shifts/propose-exchange-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { startConversation } from "@/app/(dashboard)/chat/actions";
import { withdrawProposal } from "@/components/shifts/actions";
import {
  EXCHANGE_AGREEMENT_LABELS,
  COMPENSATION_SHIFT_TYPE_LABELS,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_STYLES,
  SHIFT_STATUS_LABELS,
  SHIFT_STATUS_STYLES,
  SHIFT_TYPE_LABELS,
  SHIFT_TYPE_STYLES,
} from "@/lib/constants";
import {
  formatCompensationDateLabel,
  getMinimumCompensationDate,
} from "@/lib/exchange-compensation";
import { formatDateISO } from "@/lib/calendar";
import { getUserCalendar } from "@/lib/calendar-data";
import {
  expireStaleOpenShifts,
  isPastShiftPublicationDate,
} from "@/lib/stale-shifts";
import { formatDate, formatTimeRange } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import type { AcceptedModality, ExchangeAgreementType, RequestStatus, ShiftType, ShiftWithUser } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ShiftDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  await expireStaleOpenShifts({ shiftId: id });

  const { data: shiftData } = await supabase
    .from("shifts")
    .select(
      `
      *,
      user:user_profiles!user_id(id, email, full_name, avatar_url, department_id, company_id),
      department:departments!department_id(id, name),
      job_position:job_positions!job_position_id(id, name)
    `
    )
    .eq("id", id)
    .single();

  if (!shiftData) {
    notFound();
  }

  const shift = {
    ...shiftData,
    user: shiftData.user,
    department: shiftData.department,
    job_position: shiftData.job_position,
  } as ShiftWithUser;

  // If user has an active exchange for this shift, redirect to it
  const { data: activeExchange } = await supabase
    .from("exchanges")
    .select("id")
    .eq("shift_id", id)
    .in("status", [
      "accepted",
      "pending_validation",
      "approved",
      "completed",
    ])
    .or(`user_a_id.eq.${authUser.id},user_b_id.eq.${authUser.id}`)
    .limit(1)
    .maybeSingle();

  if (activeExchange) {
    redirect(`/exchanges/${activeExchange.id}`);
  }

  // Mark related notifications as read
  const now = new Date().toISOString();
  await supabase
    .from("notifications")
    .update({ read: true, read_at: now })
    .eq("user_id", authUser.id)
    .in("type", ["proposal_received", "proposal_rejected", "shift_cancelled"])
    .eq("read", false)
    .contains("data", { shift_id: id });

  // Load proposals
  const { data: requests } = await supabase
    .from("shift_requests")
    .select(
      `
      *,
      user:user_profiles!interested_user_id(id, email, full_name)
    `
    )
    .eq("shift_id", id)
    .order("created_at", { ascending: false });

  const typedRequests = (requests ?? []).map((request) => ({
    ...request,
    user: request.user as { id: string; email: string; full_name: string },
  }));

  const timeRange = formatTimeRange(shift.start_time, shift.end_time);
  const coverageTimeRange =
    shift.coverage_start_time && shift.coverage_end_time
      ? formatTimeRange(shift.coverage_start_time, shift.coverage_end_time)
      : null;
  const isOwner = authUser.id === shift.user_id;
  const myActiveProposal = typedRequests.find(
    (request) =>
      request.user.id === authUser.id &&
      (request.status === "pending" || request.status === "accepted")
  );
  const canPropose = !isOwner && shift.status === "open" && !myActiveProposal;
  const isExpiredByDate = isPastShiftPublicationDate(shift.date);
  const canNegotiate =
    canPropose && !isExpiredByDate;
  const showChatButton = !isOwner;
  const acceptedModalities = (shift.accepted_modalities ?? ["hours_bank", "shift_exchange"]) as AcceptedModality[];
  const shouldLoadProposalCalendar =
    canNegotiate && acceptedModalities.includes("shift_exchange");
  const minCompensationDate = getMinimumCompensationDate();
  const compensationDateSeed = new Date(
    Number(minCompensationDate.slice(0, 4)),
    Number(minCompensationDate.slice(5, 7)) - 1,
    Number(minCompensationDate.slice(8, 10))
  );
  compensationDateSeed.setDate(compensationDateSeed.getDate() + 180);
  const maxCompensationDate = formatDateISO(compensationDateSeed);
  const calendarDays = shouldLoadProposalCalendar
    ? await getUserCalendar(authUser.id, minCompensationDate, maxCompensationDate)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Detalle"
        title="Detalle del turno"
        description="Revisa la informacion clave, compara el horario y decide si quieres proponer un intercambio."
        action={
          <Link href="/shifts">
            <Button variant="ghost">
              <ArrowLeft className="size-4" />
              Volver a turnos
            </Button>
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge className={SHIFT_TYPE_STYLES[shift.shift_type as ShiftType]}>
                {SHIFT_TYPE_LABELS[shift.shift_type as ShiftType]}
              </Badge>
              <Badge className={SHIFT_STATUS_STYLES[shift.status]}>
                {SHIFT_STATUS_LABELS[shift.status]}
              </Badge>
              <Badge variant="outline" className="text-foreground">
                {shift.department.name}
              </Badge>
              {shift.job_position ? (
                <Badge variant="outline" className="text-foreground">
                  {shift.job_position.name}
                </Badge>
              ) : null}
            </div>
            <div className="space-y-2">
              <CardTitle className="text-[1.75rem]">{timeRange}</CardTitle>
              <CardDescription>{formatDate(shift.date)}</CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="rounded-2xl border border-border/70 bg-secondary/55 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Publicado por
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {shift.user.full_name}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {shift.user.email} · {shift.department.name}
                {shift.job_position ? ` - ${shift.job_position.name}` : ""}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Contexto
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                {shift.description?.trim() ||
                  "No hay notas adicionales. Si necesitas mas contexto, abre una conversacion desde aqui."}
              </p>
            </div>

            {acceptedModalities.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Acepta
                </p>
                <div className="flex flex-wrap gap-2">
                  {acceptedModalities.map((modality) => (
                    <Badge key={modality} variant="outline" className="text-foreground">
                      {EXCHANGE_AGREEMENT_LABELS[modality]}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {coverageTimeRange ? (
              <div className="rounded-2xl border border-border/70 bg-secondary/35 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Cobertura parcial
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {coverageTimeRange}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Esta publicacion solo acepta bolsa de horas para esa franja.
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              {canNegotiate && (
                <ProposeExchangeDialog
                  shiftId={shift.id}
                  acceptedModalities={acceptedModalities}
                  calendarDays={calendarDays}
                  coverageTimeRange={coverageTimeRange}
                />
              )}

              {myActiveProposal && myActiveProposal.status === "pending" && (
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className="border-sky-500/15 bg-sky-500/10 text-sky-700">
                    Propuesta enviada
                  </Badge>
                  <form action={withdrawProposal}>
                    <input type="hidden" name="request_id" value={myActiveProposal.id} />
                    <input type="hidden" name="shift_id" value={shift.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      Retirar propuesta
                    </Button>
                  </form>
                </div>
              )}

              {showChatButton && (
                <form action={startConversation}>
                  <input type="hidden" name="shift_id" value={shift.id} />
                  <input type="hidden" name="other_user_id" value={shift.user_id} />
                  <Button type="submit" variant="outline">
                    <MessageSquare className="size-4" />
                    Abrir chat
                  </Button>
                </form>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Users className="size-4 text-primary" />
              Propuestas
            </div>
            <CardDescription>
              {isOwner
                ? "Propuestas recibidas en este turno."
                : "Otras personas que han propuesto en este turno."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {typedRequests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-secondary/35 px-4 py-6 text-sm text-muted-foreground">
                Aun no hay propuestas. Cuando alguien proponga aparecera aqui.
              </div>
            ) : (
              <ul className="space-y-3">
                {typedRequests.map((request) => (
                  <li
                    key={request.id}
                    className="rounded-2xl border border-border/75 bg-background/90 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {request.user.full_name}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {request.user.email}
                        </p>
                        {request.agreement_type && (
                          <p className="text-xs text-muted-foreground">
                            {EXCHANGE_AGREEMENT_LABELS[request.agreement_type as ExchangeAgreementType]}
                            {request.agreement_type === "hours_bank" &&
                              coverageTimeRange && (
                                <> {" - "}Cobertura {coverageTimeRange}</>
                              )}
                            {request.agreement_type === "shift_exchange" &&
                              request.compensation_shift_date && (
                                <>
                                  {" — "}
                                  {request.compensation_shift_type
                                    ? COMPENSATION_SHIFT_TYPE_LABELS[
                                        request.compensation_shift_type as ShiftType | "rest"
                                      ]
                                    : "Pendiente"}{" "}
                                  del {formatCompensationDateLabel(request.compensation_shift_date)}
                                </>
                              )}
                          </p>
                        )}
                      </div>
                      <Badge className={REQUEST_STATUS_STYLES[request.status as RequestStatus]}>
                        {REQUEST_STATUS_LABELS[request.status as RequestStatus]}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
