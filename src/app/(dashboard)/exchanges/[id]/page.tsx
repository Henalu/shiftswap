import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowLeftRight,
  FileText,
  MessageSquare,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  attachExchangeDocument,
  cancelExchange,
  confirmExchange,
  confirmSignedExchangeCancellation,
  rejectSignedExchangeCancellation,
  requestSignedExchangeCancellation,
  signExchange,
} from "../actions";
import type { ExchangeStatus, ShiftType } from "@/types";

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
  const now = new Date().toISOString();

  await supabase
    .from("notifications")
    .update({ read: true, read_at: now })
    .eq("user_id", authUser.id)
    .eq("read", false)
    .contains("data", { exchange_id: id });

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
  const timeRange = formatTimeRange(typed.shift.start_time, typed.shift.end_time);

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
          <Badge className={EXCHANGE_STATUS_STYLES.signed}>Firmado</Badge>
          <p className="text-xs text-muted-foreground">{formatShortDate(signedAt)}</p>
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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Intercambio"
        title="Detalle del intercambio"
        description="Consulta el estado actual del acuerdo, revisa firmas y ejecuta solo las acciones que tocan en este momento."
        action={
          <Link href="/exchanges">
            <Button variant="ghost">
              <ArrowLeft className="size-4" />
              Volver a intercambios
            </Button>
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <Card>
          <CardHeader className="space-y-4">
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
            </div>
            <div className="space-y-1">
              <CardTitle className="text-[1.75rem]">{timeRange}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {formatShortDate(typed.shift.date)}
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ArrowLeftRight className="size-4 text-primary" />
                Partes involucradas
              </div>

              <div className="space-y-3">
                <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-secondary/45 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-background text-primary">
                      <User className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {typed.owner.full_name}{" "}
                        {isOwner && <span className="font-normal text-muted-foreground">(tu)</span>}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {typed.owner.email} · Propietario del turno
                      </p>
                    </div>
                  </div>
                  {renderSignatureStatus({
                    signedAt: typed.signed_by_user_a_at,
                    canCurrentUserSign: isOwner && typed.status === "confirmed",
                  })}
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-secondary/45 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-background text-primary">
                      <User className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {typed.requester.full_name}{" "}
                        {isRequester && (
                          <span className="font-normal text-muted-foreground">(tu)</span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {typed.requester.email} · Solicitante
                      </p>
                    </div>
                  </div>
                  {renderSignatureStatus({
                    signedAt: typed.signed_by_user_b_at,
                    canCurrentUserSign: isRequester && typed.status === "confirmed",
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/90 px-4 py-4 text-sm leading-6 text-muted-foreground">
              {typed.status === "confirmed" && !hasDocument ? (
                <>Adjunta un PDF para habilitar la firma final de ambas partes.</>
              ) : typed.status === "signed" ? (
                hasPendingCancellationRequest ? (
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
                      confirmarla o rechazarla desde esta pantalla.
                    </>
                  )
                ) : (
                  <>
                    Ambas partes han completado la firma final. A partir de aqui la
                    cancelacion debe ser solicitada por una parte y confirmada por
                    la otra.
                  </>
                )
              ) : typed.confirmed_at ? (
                <>Confirmado el {formatShortDate(typed.confirmed_at)}.</>
              ) : (
                <>Todavia no se ha confirmado el intercambio.</>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Acciones disponibles</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {typed.status === "pending_confirmation" && isRequester && (
                <form action={confirmExchange}>
                  <input type="hidden" name="exchange_id" value={typed.id} />
                  <Button type="submit">Confirmar intercambio</Button>
                </form>
              )}

              <form action={startConversation}>
                <input type="hidden" name="shift_id" value={typed.shift_id} />
                <input type="hidden" name="other_user_id" value={otherUser.id} />
                <Button type="submit" variant="secondary">
                  <MessageSquare className="size-4" />
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
                  Solicitud enviada
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
            </CardContent>
          </Card>

          {(typed.status === "confirmed" || typed.status === "signed") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Documentacion y firma</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-6 text-muted-foreground">
                  {typed.status === "signed"
                    ? "El intercambio ya esta firmado. Desde aqui puedes descargar documentos y revisar cualquier paso pendiente."
                    : "Adjunta un PDF y completa la firma final sin salir del detalle."}
                </p>

                <div className="flex flex-wrap gap-3">
                  <a href={`/api/exchanges/${typed.id}/pdf`} download>
                    <Button>
                      <FileText className="size-4" />
                      Descargar PDF generado
                    </Button>
                  </a>

                  {typed.document_url && (
                    <a href={typed.document_url} target="_blank" rel="noreferrer">
                      <Button variant="outline">
                        <FileText className="size-4" />
                        Descargar PDF adjunto
                      </Button>
                    </a>
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
                      <p className="text-sm text-muted-foreground">
                        Reemplazar el PDF reinicia las firmas ya registradas para
                        mantener coherencia con el documento actual.
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
      </div>
    </div>
  );
}
