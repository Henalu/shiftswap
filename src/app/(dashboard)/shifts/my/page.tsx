import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
} from "@/components/ui/card";
import { Plus, CalendarDays, Users } from "lucide-react";
import {
  SHIFT_TYPE_LABELS,
  SHIFT_STATUS_LABELS,
  SHIFT_STATUS_COLORS,
  REQUEST_STATUS_LABELS,
  EXCHANGE_STATUS_LABELS,
} from "@/lib/constants";
import { formatShortDate } from "@/lib/utils";
import { acceptRequest, rejectRequest } from "./actions";
import { CancelShiftButton } from "@/components/shifts/cancel-shift-button";
import type { ShiftType, RequestStatus, ExchangeStatus } from "@/types";

const EXCHANGE_STATUS_COLORS: Record<ExchangeStatus, string> = {
  pending_confirmation: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  signed: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
};

interface RequestWithUser {
  id: string;
  shift_id: string;
  interested_user_id: string;
  status: RequestStatus;
  created_at: string;
  requester: {
    id: string;
    email: string;
    full_name: string;
  };
}

interface ShiftWithRequests {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  shift_type: string;
  status: string;
  description: string | null;
  department: { id: string; name: string };
  shift_requests: RequestWithUser[];
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

  const { data: shifts } = await supabase
    .from("shifts")
    .select(
      `
      id, date, start_time, end_time, shift_type, status, description,
      department:departments!department_id(id, name),
      shift_requests(
        id, shift_id, interested_user_id, status, created_at,
        requester:user_profiles!interested_user_id(id, email, full_name)
      )
    `
    )
    .eq("user_id", authUser.id)
    .order("date", { ascending: false });

  const typedShifts = (shifts ?? []) as unknown as ShiftWithRequests[];
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
          `
          )
          .in("shift_id", shiftIds)
          .in("status", ["pending_confirmation", "confirmed", "signed", "completed"])
          .order("created_at", { ascending: false });

  const activeExchangeByShiftId = new Map<string, ActiveExchange>();
  for (const exchange of (activeExchanges ?? []) as unknown as ActiveExchange[]) {
    if (!activeExchangeByShiftId.has(exchange.shift_id)) {
      activeExchangeByShiftId.set(exchange.shift_id, exchange);
    }
  }

  const formatTime = (time: string) => {
    if (time?.includes(":")) {
      const [h, m] = time.split(":");
      return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
    }
    return time;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Mis turnos</h1>
        <Link href="/shifts/new">
          <Button>
            <Plus className="mr-2 size-4" />
            Publicar turno
          </Button>
        </Link>
      </div>

      {typedShifts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            No has publicado ningún turno todavía.
          </p>
          <Link href="/shifts/new" className="mt-4 inline-block">
            <Button variant="outline" size="sm">
              <Plus className="mr-2 size-4" />
              Publicar tu primer turno
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {typedShifts.map((shift) => {
            const activeExchange = activeExchangeByShiftId.get(shift.id);
            const timeRange = `${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}`;
            const detailHref = activeExchange
              ? `/exchanges/${activeExchange.id}`
              : `/shifts/${shift.id}`;
            const detailLabel = activeExchange ? "Ver intercambio" : "Ver detalle";
            const pendingRequests = shift.shift_requests.filter(
              (request) =>
                request.status === "pending" &&
                request.interested_user_id !== activeExchange?.user_b_id
            );
            const otherRequests = shift.shift_requests.filter(
              (request) =>
                request.status !== "pending" &&
                request.interested_user_id !== activeExchange?.user_b_id
            );
            const hasPendingCancellationRequest =
              activeExchange?.status === "signed" &&
              !!activeExchange.cancellation_requested_by;
            const isCancellationRequester =
              hasPendingCancellationRequest &&
              activeExchange?.cancellation_requested_by === authUser.id;
            const statusLabel = activeExchange
              ? EXCHANGE_STATUS_LABELS[activeExchange.status]
              : SHIFT_STATUS_LABELS[
                  shift.status as keyof typeof SHIFT_STATUS_LABELS
                ];
            const statusColor = activeExchange
              ? EXCHANGE_STATUS_COLORS[activeExchange.status]
              : SHIFT_STATUS_COLORS[
                  shift.status as keyof typeof SHIFT_STATUS_COLORS
                ];

            return (
              <Card key={shift.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarDays className="size-4" />
                        {formatShortDate(shift.date)} · {timeRange}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary">
                          {SHIFT_TYPE_LABELS[shift.shift_type as ShiftType]}
                        </Badge>
                        <Badge className={statusColor}>{statusLabel}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={detailHref}>
                        <Button variant="ghost" size="sm">
                          {detailLabel}
                        </Button>
                      </Link>
                      {!activeExchange &&
                        (shift.status === "open" || shift.status === "pending") && (
                          <CancelShiftButton shiftId={shift.id} />
                        )}
                    </div>
                  </div>
                  {shift.description && (
                    <CardDescription className="mt-1">
                      {shift.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent>
                  {activeExchange ? (
                    <div className="space-y-4">
                      <div>
                        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                          <Users className="size-4" />
                          Intercambio asociado
                        </div>
                          <div className="rounded-lg border p-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="font-medium">
                                  {activeExchange.requester.full_name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                  {activeExchange.requester.email}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Badge className={EXCHANGE_STATUS_COLORS[activeExchange.status]}>
                                  {EXCHANGE_STATUS_LABELS[activeExchange.status]}
                                </Badge>
                                {hasPendingCancellationRequest && (
                                  <Badge variant="outline">
                                    Cancelacion pendiente
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <p className="mt-3 text-sm text-muted-foreground">
                              {hasPendingCancellationRequest ? (
                                isCancellationRequester ? (
                                  <>
                                    Ya has solicitado la cancelacion de este
                                    intercambio firmado. Queda pendiente de
                                    respuesta por la otra parte.
                                  </>
                                ) : (
                                  <>
                                    La otra parte ha solicitado cancelar este
                                    intercambio firmado. Entra en el intercambio
                                    para confirmarlo o rechazarlo.
                                  </>
                                )
                              ) : (
                                <>
                                  Este caso ya se gestiona como intercambio. Usa
                                  la vista de intercambio para consultar el
                                  estado, el chat, el PDF y las acciones
                                  disponibles.
                                </>
                              )}
                            </p>
                          </div>
                        </div>

                      {shift.shift_requests.length > 1 && (
                        <div>
                          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                            <Users className="size-4" />
                            Otras solicitudes
                          </div>
                          {pendingRequests.length === 0 && otherRequests.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              No hay otras solicitudes asociadas a este turno.
                            </p>
                          ) : (
                            <ul className="space-y-2">
                              {pendingRequests.map((request) => (
                                <li
                                  key={request.id}
                                  className="flex items-center justify-between rounded-lg border p-3"
                                >
                                  <div>
                                    <p className="font-medium">
                                      {request.requester.full_name}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {request.requester.email}
                                    </p>
                                  </div>
                                  <Badge variant="outline">
                                    {REQUEST_STATUS_LABELS[request.status]}
                                  </Badge>
                                </li>
                              ))}
                              {otherRequests.map((request) => (
                                <li
                                  key={request.id}
                                  className="flex items-center justify-between rounded-lg border p-3"
                                >
                                  <div>
                                    <p className="font-medium">
                                      {request.requester.full_name}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {request.requester.email}
                                    </p>
                                  </div>
                                  <Badge variant="outline">
                                    {REQUEST_STATUS_LABELS[request.status]}
                                  </Badge>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                        <Users className="size-4" />
                        Interesados ({shift.shift_requests.length})
                      </div>

                      {shift.shift_requests.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Nadie ha mostrado interés aún.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {pendingRequests.map((request) => (
                            <li
                              key={request.id}
                              className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div>
                                <p className="font-medium">
                                  {request.requester.full_name}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {request.requester.email}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <form action={acceptRequest}>
                                  <input
                                    type="hidden"
                                    name="request_id"
                                    value={request.id}
                                  />
                                  <input
                                    type="hidden"
                                    name="shift_id"
                                    value={shift.id}
                                  />
                                  <Button type="submit" size="sm" variant="default">
                                    Aceptar
                                  </Button>
                                </form>
                                <form action={rejectRequest}>
                                  <input
                                    type="hidden"
                                    name="request_id"
                                    value={request.id}
                                  />
                                  <input
                                    type="hidden"
                                    name="shift_id"
                                    value={shift.id}
                                  />
                                  <Button type="submit" size="sm" variant="outline">
                                    Rechazar
                                  </Button>
                                </form>
                              </div>
                            </li>
                          ))}

                          {otherRequests.map((request) => (
                            <li
                              key={request.id}
                              className="flex items-center justify-between rounded-lg border p-3"
                            >
                              <div>
                                <p className="font-medium">
                                  {request.requester.full_name}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {request.requester.email}
                                </p>
                              </div>
                              <Badge variant="outline">
                                {REQUEST_STATUS_LABELS[request.status]}
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
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
