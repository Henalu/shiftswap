import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeftRight,
  CalendarDays,
  FileSignature,
  MessageSquare,
  SearchX,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { startConversation } from "@/app/(dashboard)/chat/actions";
import {
  EXCHANGE_STATUS_LABELS,
  EXCHANGE_STATUS_STYLES,
  SHIFT_TYPE_LABELS,
  SHIFT_TYPE_STYLES,
} from "@/lib/constants";
import { pickFirstRelation } from "@/lib/supabase-relations";
import { createClient } from "@/lib/supabase/server";
import { formatShortDate, formatTimeRange } from "@/lib/utils";
import {
  cancelExchange,
  confirmExchange,
} from "./actions";
import type { ExchangeStatus, ShiftType } from "@/types";

interface ExchangeRow {
  id: string;
  shift_id: string;
  user_a_id: string;
  user_b_id: string;
  status: ExchangeStatus;
  confirmed_at: string | null;
  submitted_for_approval_at: string | null;
  department_reviewed_at: string | null;
  department_decision_notes: string | null;
  signed_by_user_a_at: string | null;
  signed_by_user_b_at: string | null;
  cancellation_requested_by: string | null;
  cancellation_requested_at: string | null;
  created_at: string;
  shift: {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    shift_type: string;
    department: { id: string; name: string };
  };
  owner: { id: string; full_name: string; email: string };
  requester: { id: string; full_name: string; email: string };
}

function renderExchangeMessage(
  exchange: ExchangeRow,
  authUserId: string
): string {
  const isOwner = exchange.user_a_id === authUserId;
  const otherUser = isOwner ? exchange.requester : exchange.owner;
  const hasPendingCancellationRequest =
    exchange.status === "pending_department_approval" &&
    Boolean(exchange.cancellation_requested_by);

  if (exchange.status === "pending_confirmation") {
    return isOwner
      ? `Esperando la confirmacion final de ${otherUser.full_name} para abrir la solicitud formal.`
      : `${otherUser.full_name} ya ha aceptado el cambio. Confirma ahora para pasar a la firma interna.`;
  }

  if (exchange.status === "confirmed") {
    const currentUserSigned = isOwner
      ? Boolean(exchange.signed_by_user_a_at)
      : Boolean(exchange.signed_by_user_b_at);

    return currentUserSigned
      ? "Tu firma ya esta registrada. Falta que la otra parte complete la suya para enviar el expediente a aprobacion."
      : "El acuerdo ya existe. Tu siguiente paso es firmar la solicitud dentro de la app.";
  }

  if (exchange.status === "pending_department_approval") {
    if (hasPendingCancellationRequest) {
      return "Hay una retirada pendiente entre participantes. El expediente queda en pausa hasta resolverla.";
    }

    return "Las dos firmas ya estan registradas. Ahora toca esperar la decision del responsable del departamento.";
  }

  if (exchange.status === "approved") {
    return "El intercambio ya ha sido aprobado. Puedes abrir el expediente para revisar la resolucion y exportar el resumen.";
  }

  if (exchange.status === "rejected") {
    return "El departamento ha rechazado la solicitud. Revisa las observaciones y decide si vuelves a intentarlo.";
  }

  if (exchange.status === "cancelled") {
    return "El expediente se ha cancelado antes de cerrarse.";
  }

  return "Este intercambio ya no requiere nuevas acciones.";
}

export default async function ExchangesPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/login");

  const { data: exchanges } = await supabase
    .from("exchanges")
    .select(
      `
      id, shift_id, user_a_id, user_b_id, status, confirmed_at,
      submitted_for_approval_at, department_reviewed_at, department_decision_notes,
      signed_by_user_a_at, signed_by_user_b_at,
      cancellation_requested_by, cancellation_requested_at, created_at,
      shift:shifts!shift_id(
        id,
        date,
        start_time,
        end_time,
        shift_type,
        department:departments!department_id(id, name)
      ),
      owner:user_profiles!user_a_id(id, full_name, email),
      requester:user_profiles!user_b_id(id, full_name, email)
    `
    )
    .or(`user_a_id.eq.${authUser.id},user_b_id.eq.${authUser.id}`)
    .order("created_at", { ascending: false });

  const typedExchanges = ((exchanges ?? []) as unknown[]).map((exchange) => {
    const typed = exchange as unknown as ExchangeRow & {
      shift:
        | (ExchangeRow["shift"] & {
            department:
              | ExchangeRow["shift"]["department"]
              | ExchangeRow["shift"]["department"][];
          })
        | ExchangeRow["shift"][];
      owner: ExchangeRow["owner"] | ExchangeRow["owner"][];
      requester: ExchangeRow["requester"] | ExchangeRow["requester"][];
    };
    const shift = pickFirstRelation(typed.shift);

    return {
      ...typed,
      shift: shift
        ? {
            ...shift,
            department: pickFirstRelation(shift.department) ?? shift.department,
          }
        : null,
      owner: pickFirstRelation(typed.owner),
      requester: pickFirstRelation(typed.requester),
    };
  }).filter(
    (
      exchange
    ): exchange is ExchangeRow =>
      Boolean(exchange.shift) && Boolean(exchange.owner) && Boolean(exchange.requester)
  );
  const pendingConfirmation = typedExchanges.filter(
    (exchange) => exchange.status === "pending_confirmation"
  );
  const activeWorkflow = typedExchanges.filter(
    (exchange) =>
      exchange.status === "confirmed" ||
      exchange.status === "pending_department_approval"
  );
  const resolvedWorkflow = typedExchanges.filter(
    (exchange) =>
      exchange.status === "approved" ||
      exchange.status === "rejected" ||
      exchange.status === "cancelled" ||
      exchange.status === "completed"
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Acuerdos"
        title="Intercambios"
        description="Sigue cada expediente desde la confirmacion inicial hasta la firma, la aprobacion departamental y la resolucion final."
      />

      {typedExchanges.length === 0 ? (
        <EmptyState
          icon={<SearchX className="size-5" />}
          title="Todavia no tienes intercambios"
          description="Cuando el propietario de un turno acepte tu solicitud, el expediente aparecera aqui con sus siguientes pasos."
          action={
            <Link href="/shifts">
              <Button variant="outline">Explorar turnos</Button>
            </Link>
          }
        />
      ) : (
        <>
          {pendingConfirmation.length > 0 && (
            <section className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                  Pendientes de confirmacion
                </h2>
                <p className="text-sm text-muted-foreground">
                  Intercambios que aun necesitan la aceptacion final de la otra
                  parte para arrancar el expediente formal.
                </p>
              </div>

              <div className="space-y-4">
                {pendingConfirmation.map((exchange) => {
                  const isOwner = exchange.user_a_id === authUser.id;
                  const isRequester = exchange.user_b_id === authUser.id;
                  const otherUser = isOwner ? exchange.requester : exchange.owner;
                  const timeRange = formatTimeRange(
                    exchange.shift.start_time,
                    exchange.shift.end_time
                  );

                  return (
                    <Card key={exchange.id}>
                      <CardHeader className="space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <CalendarDays className="size-4" />
                              {formatShortDate(exchange.shift.date)} · {timeRange}
                            </div>
                            <div className="flex flex-wrap gap-2">
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
                              <Badge className={EXCHANGE_STATUS_STYLES[exchange.status]}>
                                {EXCHANGE_STATUS_LABELS[exchange.status]}
                              </Badge>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {isRequester && (
                              <form action={confirmExchange}>
                                <input type="hidden" name="exchange_id" value={exchange.id} />
                                <Button type="submit" size="sm">
                                  Confirmar
                                </Button>
                              </form>
                            )}

                            <form action={startConversation}>
                              <input type="hidden" name="shift_id" value={exchange.shift_id} />
                              <input type="hidden" name="other_user_id" value={otherUser.id} />
                              <Button type="submit" variant="secondary" size="sm">
                                <MessageSquare className="size-4" />
                                Chat
                              </Button>
                            </form>

                            <form action={cancelExchange}>
                              <input type="hidden" name="exchange_id" value={exchange.id} />
                              <Button type="submit" variant="outline" size="sm">
                                Cancelar
                              </Button>
                            </form>

                            <Link href={`/exchanges/${exchange.id}`}>
                              <Button variant="ghost" size="sm">
                                Ver expediente
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="rounded-2xl border border-border/70 bg-secondary/45 px-4 py-4 text-sm leading-6 text-muted-foreground">
                          <div className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                            <ArrowLeftRight className="size-4 text-primary" />
                            Estado actual
                          </div>
                          {renderExchangeMessage(exchange, authUser.id)}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {activeWorkflow.length > 0 && (
            <section className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                  Solicitud formal en curso
                </h2>
                <p className="text-sm text-muted-foreground">
                  Expedientes que ya han pasado la negociacion y estan en fase
                  de firma o revision departamental.
                </p>
              </div>

              <div className="space-y-4">
                {activeWorkflow.map((exchange) => {
                  const isOwner = exchange.user_a_id === authUser.id;
                  const otherUser = isOwner ? exchange.requester : exchange.owner;
                  const timeRange = formatTimeRange(
                    exchange.shift.start_time,
                    exchange.shift.end_time
                  );
                  const currentUserSigned = isOwner
                    ? Boolean(exchange.signed_by_user_a_at)
                    : Boolean(exchange.signed_by_user_b_at);

                  return (
                    <Card key={exchange.id}>
                      <CardHeader className="space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <CalendarDays className="size-4" />
                              {formatShortDate(exchange.shift.date)} · {timeRange}
                            </div>
                            <div className="flex flex-wrap gap-2">
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
                              <Badge className={EXCHANGE_STATUS_STYLES[exchange.status]}>
                                {EXCHANGE_STATUS_LABELS[exchange.status]}
                              </Badge>
                              {exchange.status === "confirmed" && !currentUserSigned && (
                                <Badge variant="outline">
                                  <FileSignature className="size-3.5" />
                                  Falta tu firma
                                </Badge>
                              )}
                              {exchange.status === "pending_department_approval" && (
                                <Badge variant="outline">
                                  <ShieldCheck className="size-3.5" />
                                  En revision
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <form action={startConversation}>
                              <input type="hidden" name="shift_id" value={exchange.shift_id} />
                              <input type="hidden" name="other_user_id" value={otherUser.id} />
                              <Button type="submit" variant="secondary" size="sm">
                                <MessageSquare className="size-4" />
                                Chat
                              </Button>
                            </form>

                            <Link href={`/exchanges/${exchange.id}`}>
                              <Button size="sm">
                                {exchange.status === "confirmed"
                                  ? currentUserSigned
                                    ? "Ver firmas"
                                    : "Firmar solicitud"
                                  : "Abrir expediente"}
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="rounded-2xl border border-border/70 bg-secondary/45 px-4 py-4 text-sm leading-6 text-muted-foreground">
                          <div className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                            <ArrowLeftRight className="size-4 text-primary" />
                            Estado actual
                          </div>
                          {renderExchangeMessage(exchange, authUser.id)}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {resolvedWorkflow.length > 0 && (
            <section className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                  Historial y resoluciones
                </h2>
                <p className="text-sm text-muted-foreground">
                  Intercambios ya aprobados, rechazados, cancelados o cerrados.
                </p>
              </div>

              <div className="space-y-4">
                {resolvedWorkflow.map((exchange) => {
                  const timeRange = formatTimeRange(
                    exchange.shift.start_time,
                    exchange.shift.end_time
                  );

                  return (
                    <Card key={exchange.id}>
                      <CardHeader className="space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <CalendarDays className="size-4" />
                              {formatShortDate(exchange.shift.date)} · {timeRange}
                            </div>
                            <div className="flex flex-wrap gap-2">
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
                              <Badge className={EXCHANGE_STATUS_STYLES[exchange.status]}>
                                {EXCHANGE_STATUS_LABELS[exchange.status]}
                              </Badge>
                            </div>
                          </div>

                          <Link href={`/exchanges/${exchange.id}`}>
                            <Button variant="ghost" size="sm">
                              Ver expediente
                            </Button>
                          </Link>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="rounded-2xl border border-border/70 bg-secondary/45 px-4 py-4 text-sm leading-6 text-muted-foreground">
                          <div className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                            <ArrowLeftRight className="size-4 text-primary" />
                            Resolucion
                          </div>
                          {renderExchangeMessage(exchange, authUser.id)}
                        </div>

                        {exchange.department_decision_notes && (
                          <div className="rounded-2xl border border-border/70 bg-background/90 px-4 py-4 text-sm leading-6 text-muted-foreground">
                            <p className="mb-2 text-sm font-semibold text-foreground">
                              Observaciones
                            </p>
                            {exchange.department_decision_notes}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
