import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeftRight,
  CalendarDays,
  MessageSquare,
  SearchX,
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
import { formatShortDate, formatTimeRange } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import {
  cancelExchange,
  confirmExchange,
  confirmSignedExchangeCancellation,
  rejectSignedExchangeCancellation,
  requestSignedExchangeCancellation,
} from "./actions";
import type { ExchangeStatus, ShiftType } from "@/types";

interface ExchangeRow {
  id: string;
  shift_id: string;
  user_a_id: string;
  user_b_id: string;
  status: ExchangeStatus;
  confirmed_at: string | null;
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
      cancellation_requested_by, cancellation_requested_at, created_at,
      shift:shifts!shift_id(id, date, start_time, end_time, shift_type,
        department:departments!department_id(id, name)),
      owner:user_profiles!user_a_id(id, full_name, email),
      requester:user_profiles!user_b_id(id, full_name, email)
    `
    )
    .or(`user_a_id.eq.${authUser.id},user_b_id.eq.${authUser.id}`)
    .order("created_at", { ascending: false });

  const typedExchanges = (exchanges ?? []) as unknown as ExchangeRow[];
  const pending = typedExchanges.filter(
    (exchange) => exchange.status === "pending_confirmation"
  );
  const others = typedExchanges.filter(
    (exchange) => exchange.status !== "pending_confirmation"
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Acuerdos"
        title="Intercambios"
        description="Consulta que acuerdos estan pendientes, cuales requieren accion inmediata y cuales ya han quedado cerrados o firmados."
      />

      {typedExchanges.length === 0 ? (
        <EmptyState
          icon={<SearchX className="size-5" />}
          title="Todavia no tienes intercambios"
          description="Cuando el propietario de un turno acepte tu solicitud, el intercambio aparecera aqui con su contexto y proximos pasos."
          action={
            <Link href="/shifts">
              <Button variant="outline">Explorar turnos</Button>
            </Link>
          }
        />
      ) : (
        <>
          {pending.length > 0 && (
            <section className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                  Pendientes de confirmacion
                </h2>
                <p className="text-sm text-muted-foreground">
                  Intercambios que todavia necesitan una respuesta para avanzar.
                </p>
              </div>

              <div className="space-y-4">
                {pending.map((exchange) => {
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
                              <Badge className={SHIFT_TYPE_STYLES[exchange.shift.shift_type as ShiftType]}>
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
                              <>
                                <form action={confirmExchange}>
                                  <input type="hidden" name="exchange_id" value={exchange.id} />
                                  <Button type="submit" size="sm">
                                    Confirmar
                                  </Button>
                                </form>
                                <form action={cancelExchange}>
                                  <input type="hidden" name="exchange_id" value={exchange.id} />
                                  <Button type="submit" variant="outline" size="sm">
                                    Cancelar
                                  </Button>
                                </form>
                              </>
                            )}

                            <form action={startConversation}>
                              <input type="hidden" name="shift_id" value={exchange.shift_id} />
                              <input
                                type="hidden"
                                name="other_user_id"
                                value={otherUser.id}
                              />
                              <Button type="submit" variant="secondary" size="sm">
                                <MessageSquare className="size-4" />
                                Chat
                              </Button>
                            </form>

                            <Link href={`/exchanges/${exchange.id}`}>
                              <Button variant="ghost" size="sm">
                                Ver detalle
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
                          {isOwner ? (
                            <>
                              Esperando que <strong>{otherUser.full_name}</strong>{" "}
                              confirme el intercambio para cerrar el acuerdo.
                            </>
                          ) : (
                            <>
                              <strong>{otherUser.full_name}</strong> ya ha aceptado
                              tu solicitud. Confirma ahora para dejar el intercambio
                              listo.
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {others.length > 0 && (
            <section className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                  Historial y seguimiento
                </h2>
                <p className="text-sm text-muted-foreground">
                  Intercambios confirmados, firmados o cancelados con sus acciones
                  disponibles.
                </p>
              </div>

              <div className="space-y-4">
                {others.map((exchange) => {
                  const isOwner = exchange.user_a_id === authUser.id;
                  const otherUser = isOwner ? exchange.requester : exchange.owner;
                  const timeRange = formatTimeRange(
                    exchange.shift.start_time,
                    exchange.shift.end_time
                  );
                  const hasPendingCancellationRequest =
                    exchange.status === "signed" &&
                    Boolean(exchange.cancellation_requested_by);
                  const isCancellationRequester =
                    exchange.cancellation_requested_by === authUser.id;
                  const canOpenChat =
                    exchange.status === "confirmed" || exchange.status === "signed";
                  const canCancelDirectly = exchange.status === "confirmed";
                  const canRequestSignedCancellation =
                    exchange.status === "signed" && !hasPendingCancellationRequest;
                  const canRespondToSignedCancellation =
                    exchange.status === "signed" &&
                    hasPendingCancellationRequest &&
                    !isCancellationRequester;

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
                              <Badge className={SHIFT_TYPE_STYLES[exchange.shift.shift_type as ShiftType]}>
                                {SHIFT_TYPE_LABELS[exchange.shift.shift_type as ShiftType]}
                              </Badge>
                              <Badge variant="outline" className="text-foreground">
                                {exchange.shift.department.name}
                              </Badge>
                              <Badge className={EXCHANGE_STATUS_STYLES[exchange.status]}>
                                {EXCHANGE_STATUS_LABELS[exchange.status]}
                              </Badge>
                              {hasPendingCancellationRequest && (
                                <Badge variant="outline">Cancelacion pendiente</Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {canOpenChat && (
                              <form action={startConversation}>
                                <input type="hidden" name="shift_id" value={exchange.shift_id} />
                                <input
                                  type="hidden"
                                  name="other_user_id"
                                  value={otherUser.id}
                                />
                                <Button type="submit" variant="secondary" size="sm">
                                  <MessageSquare className="size-4" />
                                  Chat
                                </Button>
                              </form>
                            )}

                            {canCancelDirectly && (
                              <form action={cancelExchange}>
                                <input type="hidden" name="exchange_id" value={exchange.id} />
                                <Button type="submit" variant="outline" size="sm">
                                  Cancelar
                                </Button>
                              </form>
                            )}

                            {canRequestSignedCancellation && (
                              <form action={requestSignedExchangeCancellation}>
                                <input type="hidden" name="exchange_id" value={exchange.id} />
                                <Button type="submit" variant="outline" size="sm">
                                  Solicitar cancelacion
                                </Button>
                              </form>
                            )}

                            {exchange.status === "signed" && isCancellationRequester && (
                              <Button type="button" variant="outline" size="sm" disabled>
                                Solicitud enviada
                              </Button>
                            )}

                            {canRespondToSignedCancellation && (
                              <>
                                <form action={confirmSignedExchangeCancellation}>
                                  <input type="hidden" name="exchange_id" value={exchange.id} />
                                  <Button type="submit" variant="outline" size="sm">
                                    Confirmar cancelacion
                                  </Button>
                                </form>
                                <form action={rejectSignedExchangeCancellation}>
                                  <input type="hidden" name="exchange_id" value={exchange.id} />
                                  <Button type="submit" variant="ghost" size="sm">
                                    Rechazar
                                  </Button>
                                </form>
                              </>
                            )}

                            <Link href={`/exchanges/${exchange.id}`}>
                              <Button variant="ghost" size="sm">
                                Ver detalle
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {exchange.status === "signed" &&
                          hasPendingCancellationRequest ? (
                            isCancellationRequester ? (
                              <>
                                Has solicitado cancelar este intercambio. Queda
                                pendiente de respuesta por {otherUser.full_name}.
                              </>
                            ) : (
                              <>
                                {otherUser.full_name} ha solicitado cancelar este
                                intercambio. Puedes confirmarlo o rechazarlo.
                              </>
                            )
                          ) : exchange.status === "signed" ? (
                            <>Con {otherUser.full_name} · Intercambio firmado.</>
                          ) : (
                            <>
                              Con {otherUser.full_name}
                              {exchange.confirmed_at && (
                                <> · Confirmado el {formatShortDate(exchange.confirmed_at)}</>
                              )}
                            </>
                          )}
                        </p>
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
