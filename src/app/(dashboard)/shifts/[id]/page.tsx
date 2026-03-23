import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MessageSquare, Users } from "lucide-react";
import { InterestButton } from "@/components/shifts/interest-button";
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
import {
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_STYLES,
  SHIFT_STATUS_LABELS,
  SHIFT_STATUS_STYLES,
  SHIFT_TYPE_LABELS,
  SHIFT_TYPE_STYLES,
} from "@/lib/constants";
import { formatDate, formatTimeRange } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import type { ShiftRequestWithUser, ShiftType, ShiftWithUser } from "@/types";

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

  const { data: shiftData } = await supabase
    .from("shifts")
    .select(
      `
      *,
      user:user_profiles!user_id(id, email, full_name, avatar_url, department_id, company_id),
      department:departments!department_id(id, name)
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
  } as ShiftWithUser;

  const { data: activeExchange } = await supabase
    .from("exchanges")
    .select("id")
    .eq("shift_id", id)
    .in("status", ["pending_confirmation", "confirmed", "signed", "completed"])
    .or(`user_a_id.eq.${authUser.id},user_b_id.eq.${authUser.id}`)
    .limit(1)
    .maybeSingle();

  if (activeExchange) {
    redirect(`/exchanges/${activeExchange.id}`);
  }

  const now = new Date().toISOString();

  await supabase
    .from("notifications")
    .update({ read: true, read_at: now })
    .eq("user_id", authUser.id)
    .in("type", ["shift_request", "request_rejected", "shift_cancelled"])
    .eq("read", false)
    .contains("data", { shift_id: id });

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
    user: request.user,
  })) as ShiftRequestWithUser[];

  const timeRange = formatTimeRange(shift.start_time, shift.end_time);
  const isOwner = authUser.id === shift.user_id;
  const showInterestButton = !isOwner && shift.status === "open";
  const myActiveRequest = typedRequests.find(
    (request) =>
      request.user.id === authUser.id &&
      (request.status === "pending" || request.status === "accepted")
  );
  const myRequest = typedRequests.find((request) => request.user.id === authUser.id);
  const showMessageButton = !isOwner && !!myRequest;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Detalle"
        title="Detalle del turno"
        description="Revisa la informacion clave, compara el horario y decide si quieres iniciar la conversacion o mostrar interes."
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

            <div className="flex flex-wrap gap-3">
              {showInterestButton && (
                <InterestButton
                  shiftId={shift.id}
                  initialInterested={!!myActiveRequest}
                  requestId={myActiveRequest?.id ?? null}
                />
              )}
              {showMessageButton && (
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
              Interesados
            </div>
            <CardDescription>
              Personas que han mostrado interes en este turno.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {typedRequests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-secondary/35 px-4 py-6 text-sm text-muted-foreground">
                Aun no hay solicitudes. Cuando alguien se interese aparecera aqui.
              </div>
            ) : (
              <ul className="space-y-3">
                {typedRequests.map((request) => (
                  <li
                    key={request.id}
                    className="rounded-2xl border border-border/75 bg-background/90 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {request.user.full_name}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {request.user.email}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
