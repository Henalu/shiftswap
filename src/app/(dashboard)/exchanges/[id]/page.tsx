import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, User, ArrowLeftRight, FileText, MessageSquare } from "lucide-react";
import {
  SHIFT_TYPE_LABELS,
  EXCHANGE_STATUS_LABELS,
} from "@/lib/constants";
import { formatShortDate } from "@/lib/utils";
import { confirmExchange, cancelExchange } from "../actions";
import { startConversation } from "@/app/(dashboard)/chat/actions";
import type { ShiftType, ExchangeStatus } from "@/types";

const EXCHANGE_STATUS_COLORS: Record<ExchangeStatus, string> = {
  pending_confirmation: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
};

interface ExchangeDetail {
  id: string;
  shift_id: string;
  user_a_id: string;
  user_b_id: string;
  status: ExchangeStatus;
  confirmed_at: string | null;
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

  const { data: exchange } = await supabase
    .from("exchanges")
    .select(
      `
      id, shift_id, user_a_id, user_b_id, status, confirmed_at, created_at,
      shift:shifts!shift_id(id, date, start_time, end_time, shift_type,
        department:departments!department_id(id, name)),
      owner:user_profiles!user_a_id(id, full_name, email),
      requester:user_profiles!user_b_id(id, full_name, email)
    `
    )
    .eq("id", id)
    .or(`user_a_id.eq.${authUser.id},user_b_id.eq.${authUser.id}`)
    .single();

  if (!exchange) notFound();

  const typed = exchange as unknown as ExchangeDetail;
  const isOwner = typed.user_a_id === authUser.id;
  const isRequester = typed.user_b_id === authUser.id;
  const otherUser = isOwner ? typed.requester : typed.owner;

  const formatTime = (time: string) => {
    if (time?.includes(":")) {
      const [h, m] = time.split(":");
      return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
    }
    return time;
  };

  const timeRange = `${formatTime(typed.shift.start_time)} - ${formatTime(typed.shift.end_time)}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Detalle del intercambio
        </h1>
        <Badge className={EXCHANGE_STATUS_COLORS[typed.status]}>
          {EXCHANGE_STATUS_LABELS[typed.status]}
        </Badge>
      </div>

      {/* Shift info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="size-4" />
            Turno a intercambiar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              {SHIFT_TYPE_LABELS[typed.shift.shift_type as ShiftType]}
            </Badge>
            <Badge variant="outline">{typed.shift.department.name}</Badge>
          </div>
          <p className="text-sm">
            <span className="font-medium">Fecha:</span>{" "}
            {formatShortDate(typed.shift.date)}
          </p>
          <p className="text-sm">
            <span className="font-medium">Horario:</span> {timeRange}
          </p>
        </CardContent>
      </Card>

      {/* Parties */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowLeftRight className="size-4" />
            Partes involucradas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <User className="size-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                {typed.owner.full_name}{" "}
                {isOwner && (
                  <span className="text-muted-foreground font-normal">(tú)</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">{typed.owner.email} · Propietario del turno</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <User className="size-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                {typed.requester.full_name}{" "}
                {isRequester && (
                  <span className="text-muted-foreground font-normal">(tú)</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {typed.requester.email} · Solicitante
              </p>
            </div>
          </div>
          {typed.confirmed_at && (
            <p className="text-sm text-muted-foreground">
              Confirmado el {formatShortDate(typed.confirmed_at)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      {typed.status === "pending_confirmation" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acciones</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {isRequester && (
              <form action={confirmExchange}>
                <input type="hidden" name="exchange_id" value={typed.id} />
                <Button type="submit" variant="default">
                  Confirmar intercambio
                </Button>
              </form>
            )}
            {isOwner && (
              <p className="text-sm text-muted-foreground self-center">
                Esperando confirmación de {otherUser.full_name}.
              </p>
            )}
            <form action={startConversation}>
              <input type="hidden" name="shift_id" value={typed.shift_id} />
              <input type="hidden" name="other_user_id" value={otherUser.id} />
              <Button type="submit" variant="secondary">
                <MessageSquare className="mr-2 size-4" />
                Ir al chat
              </Button>
            </form>
            <form action={cancelExchange}>
              <input type="hidden" name="exchange_id" value={typed.id} />
              <Button type="submit" variant="outline">
                Cancelar intercambio
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {typed.status === "confirmed" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documento de confirmación</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              El intercambio ha sido confirmado por ambas partes. Descarga el documento para tus registros.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href={`/api/exchanges/${typed.id}/pdf`} download>
                <Button variant="default">
                  <FileText className="mr-2 size-4" />
                  Descargar PDF
                </Button>
              </a>
              <form action={startConversation}>
                <input type="hidden" name="shift_id" value={typed.shift_id} />
                <input type="hidden" name="other_user_id" value={otherUser.id} />
                <Button type="submit" variant="secondary">
                  <MessageSquare className="mr-2 size-4" />
                  Ir al chat
                </Button>
              </form>
              <form action={cancelExchange}>
                <input type="hidden" name="exchange_id" value={typed.id} />
                <Button type="submit" variant="outline">
                  Cancelar intercambio
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
