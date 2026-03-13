import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CalendarDays,
  User,
  ArrowLeftRight,
  FileText,
  MessageSquare,
} from "lucide-react";
import {
  EXCHANGE_STATUS_LABELS,
  SHIFT_TYPE_LABELS,
} from "@/lib/constants";
import { formatShortDate } from "@/lib/utils";
import {
  attachExchangeDocument,
  cancelExchange,
  confirmExchange,
  confirmSignedExchangeCancellation,
  rejectSignedExchangeCancellation,
  requestSignedExchangeCancellation,
  signExchange,
} from "../actions";
import { startConversation } from "@/app/(dashboard)/chat/actions";
import type { ExchangeStatus, ShiftType } from "@/types";

const EXCHANGE_STATUS_COLORS: Record<ExchangeStatus, string> = {
  pending_confirmation: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  signed: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
};

interface ExchangeDetail {
  id: string;
  shift_id: string;
  user_a_id: string;
  user_b_id: string;
  status: ExchangeStatus;
  document_url: string | null;
  confirmed_at: string | null;
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

async function attachExchangeDocumentAction(formData: FormData): Promise<void> {
  "use server";

  await attachExchangeDocument(formData);
}

async function signExchangeAction(formData: FormData): Promise<void> {
  "use server";

  await signExchange(formData);
}

async function requestSignedExchangeCancellationAction(
  formData: FormData
): Promise<void> {
  "use server";

  await requestSignedExchangeCancellation(formData);
}

async function confirmSignedExchangeCancellationAction(
  formData: FormData
): Promise<void> {
  "use server";

  await confirmSignedExchangeCancellation(formData);
}

async function rejectSignedExchangeCancellationAction(
  formData: FormData
): Promise<void> {
  "use server";

  await rejectSignedExchangeCancellation(formData);
}

function formatTime(time: string) {
  if (time.includes(":")) {
    const [hours, minutes] = time.split(":");
    return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
  }

  return time;
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
      id, shift_id, user_a_id, user_b_id, status, document_url, confirmed_at,
      signed_by_user_a_at, signed_by_user_b_at,
      cancellation_requested_by, cancellation_requested_at, created_at,
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
  const hasDocument = Boolean(typed.document_url);
  const canUploadDocument = typed.status === "confirmed";
  const canCancelDirectly =
    typed.status === "pending_confirmation" || typed.status === "confirmed";
  const hasPendingCancellationRequest =
    typed.status === "signed" && Boolean(typed.cancellation_requested_by);
  const isCancellationRequester =
    hasPendingCancellationRequest &&
    typed.cancellation_requested_by === authUser.id;
  const canRequestSignedCancellation =
    typed.status === "signed" && !hasPendingCancellationRequest;
  const canRespondToSignedCancellation =
    typed.status === "signed" &&
    hasPendingCancellationRequest &&
    !isCancellationRequester;
  const signaturesStarted =
    Boolean(typed.signed_by_user_a_at) || Boolean(typed.signed_by_user_b_at);
  const timeRange = `${formatTime(typed.shift.start_time)} - ${formatTime(typed.shift.end_time)}`;

  const renderSignatureStatus = ({
    signedAt,
    canCurrentUserSign,
  }: {
    signedAt: string | null;
    canCurrentUserSign: boolean;
  }) => {
    if (signedAt) {
      return (
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <Badge className="bg-green-100 text-green-800">Firmado</Badge>
          <p className="text-xs text-muted-foreground">
            {formatShortDate(signedAt)}
          </p>
        </div>
      );
    }

    if (canCurrentUserSign) {
      return (
        <form action={signExchangeAction}>
          <input type="hidden" name="exchange_id" value={typed.id} />
          <Button type="submit" size="sm" disabled={!hasDocument}>
            Firmar
          </Button>
        </form>
      );
    }

    return <Badge variant="outline">Pendiente</Badge>;
  };

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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowLeftRight className="size-4" />
            Partes involucradas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <User className="size-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {typed.owner.full_name}{" "}
                  {isOwner && (
                    <span className="font-normal text-muted-foreground">(tu)</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {typed.owner.email} · Propietario del turno
                </p>
              </div>
            </div>
            {renderSignatureStatus({
              signedAt: typed.signed_by_user_a_at,
              canCurrentUserSign: isOwner && typed.status === "confirmed",
            })}
          </div>

          <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <User className="size-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {typed.requester.full_name}{" "}
                  {isRequester && (
                    <span className="font-normal text-muted-foreground">(tu)</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {typed.requester.email} · Solicitante
                </p>
              </div>
            </div>
            {renderSignatureStatus({
              signedAt: typed.signed_by_user_b_at,
              canCurrentUserSign: isRequester && typed.status === "confirmed",
            })}
          </div>

          {typed.confirmed_at && (
            <p className="text-sm text-muted-foreground">
              Confirmado el {formatShortDate(typed.confirmed_at)}
            </p>
          )}

          {typed.status === "confirmed" && !hasDocument && (
            <p className="text-sm text-muted-foreground">
              Adjunta un PDF para habilitar la firma final de ambas partes.
            </p>
          )}

          {typed.status === "signed" && (
            <p className="text-sm text-muted-foreground">
              {hasPendingCancellationRequest ? (
                isCancellationRequester ? (
                  <>
                    Has solicitado la cancelacion el{" "}
                    {formatShortDate(typed.cancellation_requested_at!)}. Queda
                    pendiente de confirmacion por {otherUser.full_name}.
                  </>
                ) : (
                  <>
                    {otherUser.full_name} ha solicitado la cancelacion el{" "}
                    {formatShortDate(typed.cancellation_requested_at!)}. Puedes
                    confirmarla o rechazarla desde esta misma pantalla.
                  </>
                )
              ) : (
                <>
                  Ambas partes han completado la firma final. A partir de aqui
                  la cancelacion ya no es unilateral: una parte debe solicitarla
                  y la otra confirmarla.
                </>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      {typed.status === "pending_confirmation" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acciones</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {isRequester && (
              <form action={confirmExchange}>
                <input type="hidden" name="exchange_id" value={typed.id} />
                <Button type="submit">Confirmar intercambio</Button>
              </form>
            )}

            {isOwner && (
              <p className="self-center text-sm text-muted-foreground">
                Esperando confirmacion de {otherUser.full_name}.
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

            {canCancelDirectly && (
              <form action={cancelExchange}>
                <input type="hidden" name="exchange_id" value={typed.id} />
                <Button type="submit" variant="outline">
                  Cancelar intercambio
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {(typed.status === "confirmed" || typed.status === "signed") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documentacion y firma final</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {typed.status === "signed"
                ? "El intercambio ya esta firmado. Puedes descargar el documento generado, consultar el PDF adjunto y gestionar una posible cancelacion reciproca sin salir del detalle."
                : "Adjunta un PDF asociado al intercambio y completa la firma final de ambas partes desde la seccion superior."}
            </p>

            <div className="flex flex-wrap gap-3">
              <a href={`/api/exchanges/${typed.id}/pdf`} download>
                <Button variant="default">
                  <FileText className="mr-2 size-4" />
                  Descargar PDF generado
                </Button>
              </a>

              {typed.document_url && (
                <a href={typed.document_url} target="_blank" rel="noreferrer">
                  <Button variant="outline">
                    <FileText className="mr-2 size-4" />
                    Descargar PDF adjunto
                  </Button>
                </a>
              )}

              <form action={startConversation}>
                <input type="hidden" name="shift_id" value={typed.shift_id} />
                <input type="hidden" name="other_user_id" value={otherUser.id} />
                <Button type="submit" variant="secondary">
                  <MessageSquare className="mr-2 size-4" />
                  Ir al chat
                </Button>
              </form>

              {typed.status === "confirmed" && (
                <form action={cancelExchange}>
                  <input type="hidden" name="exchange_id" value={typed.id} />
                  <Button type="submit" variant="outline">
                    Cancelar intercambio
                  </Button>
                </form>
              )}

              {canRequestSignedCancellation && (
                <form action={requestSignedExchangeCancellationAction}>
                  <input type="hidden" name="exchange_id" value={typed.id} />
                  <Button type="submit" variant="outline">
                    Solicitar cancelacion
                  </Button>
                </form>
              )}

              {typed.status === "signed" && isCancellationRequester && (
                <Button type="button" variant="outline" disabled>
                  Solicitud de cancelacion enviada
                </Button>
              )}

              {canRespondToSignedCancellation && (
                <>
                  <form action={confirmSignedExchangeCancellationAction}>
                    <input type="hidden" name="exchange_id" value={typed.id} />
                    <Button type="submit" variant="outline">
                      Confirmar cancelacion
                    </Button>
                  </form>
                  <form action={rejectSignedExchangeCancellationAction}>
                    <input type="hidden" name="exchange_id" value={typed.id} />
                    <Button type="submit" variant="ghost">
                      Rechazar solicitud
                    </Button>
                  </form>
                </>
              )}
            </div>

            {canUploadDocument && (
              <form action={attachExchangeDocumentAction} className="space-y-3">
                <input type="hidden" name="exchange_id" value={typed.id} />
                <div className="space-y-2">
                  <label htmlFor="document" className="text-sm font-medium">
                    PDF adjunto del intercambio
                  </label>
                  <Input
                    id="document"
                    name="document"
                    type="file"
                    accept="application/pdf"
                    required
                  />
                </div>
                {signaturesStarted && (
                  <p className="text-xs text-muted-foreground">
                    Reemplazar el PDF reinicia las firmas ya registradas para
                    mantener coherencia con el documento adjunto actual.
                  </p>
                )}
                <Button type="submit" variant="outline">
                  {typed.document_url ? "Reemplazar PDF adjunto" : "Adjuntar PDF"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
