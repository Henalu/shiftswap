import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CalendarDays, ArrowLeftRight, MessageSquare } from "lucide-react";
import {
  EXCHANGE_STATUS_LABELS,
  SHIFT_TYPE_LABELS,
} from "@/lib/constants";
import { formatShortDate } from "@/lib/utils";
import {
  cancelExchange,
  confirmExchange,
  confirmSignedExchangeCancellation,
  rejectSignedExchangeCancellation,
  requestSignedExchangeCancellation,
} from "./actions";
import { startConversation } from "@/app/(dashboard)/chat/actions";
import type { ExchangeStatus, ShiftType } from "@/types";

const EXCHANGE_STATUS_COLORS: Record<ExchangeStatus, string> = {
  pending_confirmation: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  signed: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
};

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

function formatTime(time: string) {
  if (time.includes(":")) {
    const [hours, minutes] = time.split(":");
    return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
  }

  return time;
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
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Intercambios</h1>

      {typedExchanges.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No tienes intercambios aun.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando el propietario de un turno acepte tu solicitud, aparecera
            aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {pending.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Pendientes de confirmacion ({pending.length})
              </h2>
              <div className="space-y-3">
                {pending.map((exchange) => {
                  const isOwner = exchange.user_a_id === authUser.id;
                  const isRequester = exchange.user_b_id === authUser.id;
                  const otherUser = isOwner
                    ? exchange.requester
                    : exchange.owner;
                  const timeRange = `${formatTime(exchange.shift.start_time)} - ${formatTime(exchange.shift.end_time)}`;

                  return (
                    <Card key={exchange.id}>
                      <CardHeader className="pb-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <CalendarDays className="size-4" />
                              {formatShortDate(exchange.shift.date)} · {timeRange}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="secondary">
                                {SHIFT_TYPE_LABELS[exchange.shift.shift_type as ShiftType]}
                              </Badge>
                              <Badge variant="outline">
                                {exchange.shift.department.name}
                              </Badge>
                              <Badge className={EXCHANGE_STATUS_COLORS[exchange.status]}>
                                {EXCHANGE_STATUS_LABELS[exchange.status]}
                              </Badge>
                            </div>
                          </div>

                          {isRequester ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <form action={confirmExchange}>
                                <input
                                  type="hidden"
                                  name="exchange_id"
                                  value={exchange.id}
                                />
                                <Button type="submit" size="sm">
                                  Confirmar
                                </Button>
                              </form>
                              <form action={cancelExchange}>
                                <input
                                  type="hidden"
                                  name="exchange_id"
                                  value={exchange.id}
                                />
                                <Button type="submit" variant="outline" size="sm">
                                  Cancelar
                                </Button>
                              </form>
                              <form action={startConversation}>
                                <input
                                  type="hidden"
                                  name="shift_id"
                                  value={exchange.shift_id}
                                />
                                <input
                                  type="hidden"
                                  name="other_user_id"
                                  value={otherUser.id}
                                />
                                <Button type="submit" variant="secondary" size="sm">
                                  <MessageSquare className="mr-1.5 size-3.5" />
                                  Chat
                                </Button>
                              </form>
                              <Link href={`/exchanges/${exchange.id}`}>
                                <Button variant="ghost" size="sm">
                                  Ver detalle
                                </Button>
                              </Link>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              <form action={startConversation}>
                                <input
                                  type="hidden"
                                  name="shift_id"
                                  value={exchange.shift_id}
                                />
                                <input
                                  type="hidden"
                                  name="other_user_id"
                                  value={otherUser.id}
                                />
                                <Button type="submit" variant="secondary" size="sm">
                                  <MessageSquare className="mr-1.5 size-3.5" />
                                  Chat
                                </Button>
                              </form>
                              <Link href={`/exchanges/${exchange.id}`}>
                                <Button variant="outline" size="sm">
                                  Ver detalle
                                </Button>
                              </Link>
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 text-sm">
                          <ArrowLeftRight className="size-4 text-muted-foreground" />
                          <span>
                            {isOwner ? (
                              <>
                                Esperando que{" "}
                                <span className="font-medium">
                                  {otherUser.full_name}
                                </span>{" "}
                                confirme el intercambio
                              </>
                            ) : (
                              <>
                                <span className="font-medium">
                                  {otherUser.full_name}
                                </span>{" "}
                                ha aceptado tu solicitud. Confirma para cerrar el
                                trato.
                              </>
                            )}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {others.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Historial
              </h2>
              <div className="space-y-3">
                {others.map((exchange) => {
                  const isOwner = exchange.user_a_id === authUser.id;
                  const otherUser = isOwner
                    ? exchange.requester
                    : exchange.owner;
                  const timeRange = `${formatTime(exchange.shift.start_time)} - ${formatTime(exchange.shift.end_time)}`;
                  const hasPendingCancellationRequest =
                    exchange.status === "signed" &&
                    Boolean(exchange.cancellation_requested_by);
                  const isCancellationRequester =
                    exchange.cancellation_requested_by === authUser.id;
                  const canOpenChat =
                    exchange.status === "confirmed" ||
                    exchange.status === "signed";
                  const canCancelDirectly = exchange.status === "confirmed";
                  const canRequestSignedCancellation =
                    exchange.status === "signed" &&
                    !hasPendingCancellationRequest;
                  const canRespondToSignedCancellation =
                    exchange.status === "signed" &&
                    hasPendingCancellationRequest &&
                    !isCancellationRequester;

                  return (
                    <Card key={exchange.id}>
                      <CardHeader className="pb-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <CalendarDays className="size-4" />
                              {formatShortDate(exchange.shift.date)} · {timeRange}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="secondary">
                                {SHIFT_TYPE_LABELS[exchange.shift.shift_type as ShiftType]}
                              </Badge>
                              <Badge variant="outline">
                                {exchange.shift.department.name}
                              </Badge>
                              <Badge className={EXCHANGE_STATUS_COLORS[exchange.status]}>
                                {EXCHANGE_STATUS_LABELS[exchange.status]}
                              </Badge>
                              {hasPendingCancellationRequest && (
                                <Badge variant="outline">
                                  Cancelacion pendiente
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {canOpenChat && (
                              <form action={startConversation}>
                                <input
                                  type="hidden"
                                  name="shift_id"
                                  value={exchange.shift_id}
                                />
                                <input
                                  type="hidden"
                                  name="other_user_id"
                                  value={otherUser.id}
                                />
                                <Button type="submit" variant="secondary" size="sm">
                                  <MessageSquare className="mr-1.5 size-3.5" />
                                  Chat
                                </Button>
                              </form>
                            )}

                            {canCancelDirectly && (
                              <form action={cancelExchange}>
                                <input
                                  type="hidden"
                                  name="exchange_id"
                                  value={exchange.id}
                                />
                                <Button type="submit" variant="outline" size="sm">
                                  Cancelar
                                </Button>
                              </form>
                            )}

                            {canRequestSignedCancellation && (
                              <form action={requestSignedExchangeCancellation}>
                                <input
                                  type="hidden"
                                  name="exchange_id"
                                  value={exchange.id}
                                />
                                <Button type="submit" variant="outline" size="sm">
                                  Solicitar cancelacion
                                </Button>
                              </form>
                            )}

                            {exchange.status === "signed" &&
                              isCancellationRequester && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled
                                >
                                  Solicitud enviada
                                </Button>
                              )}

                            {canRespondToSignedCancellation && (
                              <>
                                <form action={confirmSignedExchangeCancellation}>
                                  <input
                                    type="hidden"
                                    name="exchange_id"
                                    value={exchange.id}
                                  />
                                  <Button
                                    type="submit"
                                    variant="outline"
                                    size="sm"
                                  >
                                    Confirmar cancelacion
                                  </Button>
                                </form>
                                <form action={rejectSignedExchangeCancellation}>
                                  <input
                                    type="hidden"
                                    name="exchange_id"
                                    value={exchange.id}
                                  />
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
                        <p className="text-sm text-muted-foreground">
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
                            <>Con {otherUser.full_name} · Intercambio firmado</>
                          ) : (
                            <>
                              Con {otherUser.full_name}
                              {exchange.confirmed_at && (
                                <>
                                  {" "}
                                  · Confirmado el{" "}
                                  {formatShortDate(exchange.confirmed_at)}
                                </>
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
        </div>
      )}
    </div>
  );
}
