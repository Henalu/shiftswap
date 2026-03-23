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
  EXCHANGE_STATUS_LABELS,
  EXCHANGE_STATUS_STYLES,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_STYLES,
  SHIFT_STATUS_LABELS,
  SHIFT_STATUS_STYLES,
  SHIFT_TYPE_LABELS,
  SHIFT_TYPE_STYLES,
} from "@/lib/constants";
import { formatShortDate, formatTimeRange } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { acceptRequest, rejectRequest } from "./actions";
import type { ExchangeStatus, RequestStatus, ShiftType } from "@/types";

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
          .in("status", [
            "pending_confirmation",
            "confirmed",
            "signed",
            "completed",
          ])
          .order("created_at", { ascending: false });

  const activeExchangeByShiftId = new Map<string, ActiveExchange>();
  for (const exchange of (activeExchanges ?? []) as unknown as ActiveExchange[]) {
    if (!activeExchangeByShiftId.has(exchange.shift_id)) {
      activeExchangeByShiftId.set(exchange.shift_id, exchange);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gestion"
        title="Mis turnos"
        description="Supervisa tus publicaciones, revisa solicitudes pendientes y detecta rapido cuando un turno ya esta evolucionando hacia un intercambio."
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
          description="Cuando publiques tu primer turno podras gestionar solicitudes, negociar y seguir el estado del intercambio desde aqui."
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
                        <Badge className={SHIFT_TYPE_STYLES[shift.shift_type as ShiftType]}>
                          {SHIFT_TYPE_LABELS[shift.shift_type as ShiftType]}
                        </Badge>
                        <Badge className={statusClassName}>{statusLabel}</Badge>
                        <Badge variant="outline" className="text-foreground">
                          {shift.department.name}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
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
                            <Badge className={EXCHANGE_STATUS_STYLES[activeExchange.status]}>
                              {EXCHANGE_STATUS_LABELS[activeExchange.status]}
                            </Badge>
                            {hasPendingCancellationRequest && (
                              <Badge variant="outline">Cancelacion pendiente</Badge>
                            )}
                          </div>
                        </div>
                        <p className="mt-4 text-sm leading-6 text-muted-foreground">
                          {hasPendingCancellationRequest ? (
                            isCancellationRequester ? (
                              <>
                                Ya has solicitado la cancelacion de este intercambio
                                firmado. Queda pendiente de respuesta por la otra
                                parte.
                              </>
                            ) : (
                              <>
                                La otra parte ha solicitado cancelar este intercambio
                                firmado. Entra en el intercambio para confirmarlo o
                                rechazarlo.
                              </>
                            )
                          ) : (
                            <>
                              Este caso ya se gestiona como intercambio. Usa la vista
                              de detalle para consultar estado, chat, documento y
                              acciones disponibles.
                            </>
                          )}
                        </p>
                      </div>

                      {shift.shift_requests.length > 1 && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <Users className="size-4 text-primary" />
                            Otras solicitudes
                          </div>
                          {pendingRequests.length === 0 && otherRequests.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              No hay otras solicitudes asociadas a este turno.
                            </p>
                          ) : (
                            <ul className="space-y-3">
                              {[...pendingRequests, ...otherRequests].map((request) => (
                                <li
                                  key={request.id}
                                  className="rounded-2xl border border-border/75 bg-background/90 px-4 py-4"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-foreground">
                                        {request.requester.full_name}
                                      </p>
                                      <p className="truncate text-sm text-muted-foreground">
                                        {request.requester.email}
                                      </p>
                                    </div>
                                    <Badge className={REQUEST_STATUS_STYLES[request.status]}>
                                      {REQUEST_STATUS_LABELS[request.status]}
                                    </Badge>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Users className="size-4 text-primary" />
                        Interesados ({shift.shift_requests.length})
                      </div>

                      {shift.shift_requests.length === 0 ? (
                        <p className="rounded-2xl border border-dashed border-border/80 bg-secondary/35 px-4 py-6 text-sm text-muted-foreground">
                          Todavia nadie ha mostrado interes por este turno.
                        </p>
                      ) : (
                        <ul className="space-y-3">
                          {pendingRequests.map((request) => (
                            <li
                              key={request.id}
                              className="rounded-2xl border border-border/75 bg-background/90 px-4 py-4"
                            >
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-foreground">
                                    {request.requester.full_name}
                                  </p>
                                  <p className="truncate text-sm text-muted-foreground">
                                    {request.requester.email}
                                  </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
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
                                    <Button type="submit" size="sm">
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
                              </div>
                            </li>
                          ))}

                          {otherRequests.map((request) => (
                            <li
                              key={request.id}
                              className="rounded-2xl border border-border/75 bg-background/90 px-4 py-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-foreground">
                                    {request.requester.full_name}
                                  </p>
                                  <p className="truncate text-sm text-muted-foreground">
                                    {request.requester.email}
                                  </p>
                                </div>
                                <Badge className={REQUEST_STATUS_STYLES[request.status]}>
                                  {REQUEST_STATUS_LABELS[request.status]}
                                </Badge>
                              </div>
                            </li>
                          ))}
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
