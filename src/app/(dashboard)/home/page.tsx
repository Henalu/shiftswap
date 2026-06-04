import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  MessageSquare,
  Plus,
  Repeat,
  Search,
  ShieldCheck,
} from "lucide-react";
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
import {
  CALENDAR_DAY_TYPE_LABELS,
  CALENDAR_DAY_TYPE_STYLES,
  EXCHANGE_STATUS_LABELS,
  EXCHANGE_STATUS_STYLES,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_STYLES,
  SHIFT_TYPE_LABELS,
  SHIFT_TYPE_STYLES,
} from "@/lib/constants";
import { getUserCalendar } from "@/lib/calendar-data";
import { todayISO } from "@/lib/calendar";
import { pickFirstRelation } from "@/lib/supabase-relations";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasAdminPanelAccess } from "@/lib/user-roles";
import { cn, formatShortDate, formatTimeRange } from "@/lib/utils";
import type {
  CalendarDayType,
  ExchangeStatus,
  RequestStatus,
  ShiftStatus,
  ShiftType,
  UserRole,
} from "@/types";

interface HomeProfile {
  id: string;
  full_name: string | null;
  company_id: string | null;
  department_id: string | null;
  role: UserRole;
}

interface HomeDepartment {
  id: string;
  company_id: string;
  name: string;
  parent_department_id: string | null;
  is_assignable: boolean | null;
}

interface HomeUser {
  id: string;
  full_name: string | null;
  email?: string | null;
}

interface HomeShift {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  shift_type: ShiftType;
  status: ShiftStatus;
  department?: HomeDepartment | HomeDepartment[] | null;
  user?: HomeUser | HomeUser[] | null;
  shift_requests?: Array<{
    id: string;
    status: RequestStatus;
  }>;
}

interface ProposalRow {
  id: string;
  created_at: string;
  agreement_type: string | null;
  status: RequestStatus;
  requester?: HomeUser | HomeUser[] | null;
  shift?: HomeShift | HomeShift[] | null;
}

interface MyRequestRow {
  id: string;
  status: RequestStatus;
  created_at: string;
  shift?: HomeShift | HomeShift[] | null;
}

interface ExchangeRow {
  id: string;
  status: ExchangeStatus;
  user_a_id: string;
  user_b_id: string;
  signed_by_user_b_at: string | null;
  created_at: string;
  shift?: HomeShift | HomeShift[] | null;
  owner?: HomeUser | HomeUser[] | null;
  requester?: HomeUser | HomeUser[] | null;
}

interface HomeNotification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  data?: {
    action_url?: string;
  } | null;
}

function addDaysISO(dateStr: string, days: number) {
  const date = new Date(
    Number(dateStr.slice(0, 4)),
    Number(dateStr.slice(5, 7)) - 1,
    Number(dateStr.slice(8, 10)),
  );
  date.setDate(date.getDate() + days);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatAgendaDate(dateStr: string) {
  const date = new Date(
    Number(dateStr.slice(0, 4)),
    Number(dateStr.slice(5, 7)) - 1,
    Number(dateStr.slice(8, 10)),
  );

  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    weekday: "short",
  });
}

function getFirstName(name: string | null | undefined) {
  return name?.trim().split(/\s+/)[0] ?? "equipo";
}

function normalizeShift(rawShift: HomeShift | HomeShift[] | null | undefined) {
  const shift = pickFirstRelation(rawShift);

  if (!shift) {
    return null;
  }

  return {
    ...shift,
    department: pickFirstRelation(shift.department),
    user: pickFirstRelation(shift.user),
  };
}

type NormalizedHomeShift = NonNullable<ReturnType<typeof normalizeShift>>;

function isNormalizedHomeShift(
  shift: ReturnType<typeof normalizeShift>,
): shift is NormalizedHomeShift {
  return Boolean(shift);
}

function MetricCard({
  description,
  icon: Icon,
  label,
  tone = "default",
  value,
}: {
  description: string;
  icon: typeof CalendarDays;
  label: string;
  tone?: "default" | "attention";
  value: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-32 items-center gap-4 rounded-2xl border border-border/80 bg-card/96 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]",
        tone === "attention" ? "border-amber-500/20 bg-amber-500/8" : "",
      )}
    >
      <div
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary",
          tone === "attention" ? "bg-amber-500/10 text-amber-700" : "",
        )}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-foreground">
          {value}
        </p>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

function SectionTitle({
  description,
  title,
}: {
  description?: string;
  title: string;
}) {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
        {title}
      </h2>
      {description ? (
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

function ShiftSummaryRow({
  actionLabel,
  href,
  shift,
}: {
  actionLabel: string;
  href: string;
  shift: ReturnType<typeof normalizeShift>;
}) {
  if (!shift) {
    return null;
  }

  return (
    <Link
      className="group flex items-center justify-between gap-4 rounded-2xl border border-border/70 px-4 py-3 transition-colors hover:bg-secondary/45"
      href={href}
    >
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={SHIFT_TYPE_STYLES[shift.shift_type]}>
            {SHIFT_TYPE_LABELS[shift.shift_type]}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {formatShortDate(shift.date)} -{" "}
            {formatTimeRange(shift.start_time, shift.end_time)}
          </span>
        </div>
        <p className="truncate text-sm font-medium text-foreground">
          {shift.user?.full_name ?? shift.department?.name ?? "Turno publicado"}
        </p>
      </div>
      <span className="hidden shrink-0 items-center gap-2 text-sm font-semibold text-primary sm:flex">
        {actionLabel}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

export default async function HomePage() {
  const supabase = await createClient();
  const adminClient = createAdminClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const today = todayISO();
  const agendaEnd = addDaysISO(today, 6);

  const [{ data: profile }, { data: departments }] = await Promise.all([
    adminClient
      .from("user_profiles")
      .select("id, full_name, company_id, department_id, role")
      .eq("id", authUser.id)
      .maybeSingle(),
    adminClient
      .from("departments")
      .select("id, company_id, name, parent_department_id, is_assignable")
      .order("name", { ascending: true }),
  ]);

  if (!profile) {
    redirect("/profile?setup=1");
  }

  const typedProfile = profile as HomeProfile;
  const typedDepartments = (departments ?? []) as HomeDepartment[];
  const role = typedProfile.role ?? "member";
  const canUseAdmin = hasAdminPanelAccess(role);
  const companyDepartmentIds =
    role === "hr_admin" && typedProfile.company_id
      ? typedDepartments
          .filter((department) => department.company_id === typedProfile.company_id)
          .map((department) => department.id)
      : [];
  const scopedDepartmentIds =
    role === "super_admin"
      ? null
      : role === "hr_admin"
        ? companyDepartmentIds
        : typedProfile.department_id
          ? [typedProfile.department_id]
          : [];
  const canLoadAvailableShifts =
    scopedDepartmentIds === null || scopedDepartmentIds.length > 0;

  const calendarPromise = getUserCalendar(authUser.id, today, agendaEnd);

  let availableShiftsPromise:
    | Promise<{ data: unknown[] | null; count?: number | null }>
    | null = null;
  let availableShiftCountPromise:
    | Promise<{ data: null; count: number | null }>
    | null = null;

  if (canLoadAvailableShifts) {
    let rowsQuery = supabase
      .from("shifts")
      .select(
        `
        id, date, start_time, end_time, shift_type, status,
        department:departments!department_id(id, company_id, name, parent_department_id, is_assignable),
        user:user_profiles!user_id(id, full_name)
      `,
      )
      .eq("status", "open")
      .gte("date", today)
      .is("direct_recipient_id", null)
      .neq("user_id", authUser.id)
      .order("date", { ascending: true })
      .limit(4);

    let countQuery = supabase
      .from("shifts")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .gte("date", today)
      .is("direct_recipient_id", null)
      .neq("user_id", authUser.id);

    if (scopedDepartmentIds) {
      rowsQuery = rowsQuery.in("department_id", scopedDepartmentIds);
      countQuery = countQuery.in("department_id", scopedDepartmentIds);
    }

    availableShiftsPromise = rowsQuery as unknown as Promise<{
      data: unknown[] | null;
      count?: number | null;
    }>;
    availableShiftCountPromise = countQuery as unknown as Promise<{
      data: null;
      count: number | null;
    }>;
  }

  const [
    calendarDays,
    availableShiftsResult,
    availableShiftCountResult,
    { data: myPublishedShifts },
    { data: pendingProposals },
    { data: myRequests },
    { data: activeExchanges },
    { data: notifications },
    unreadResult,
  ] = await Promise.all([
    calendarPromise,
    availableShiftsPromise ?? Promise.resolve({ data: [], count: 0 }),
    availableShiftCountPromise ?? Promise.resolve({ data: null, count: 0 }),
    supabase
      .from("shifts")
      .select(
        `
        id, date, start_time, end_time, shift_type, status,
        shift_requests(id, status)
      `,
      )
      .eq("user_id", authUser.id)
      .gte("date", today)
      .in("status", ["open", "negotiating"])
      .order("date", { ascending: true })
      .limit(4),
    supabase
      .from("shift_requests")
      .select(
        `
        id, created_at, agreement_type, status,
        requester:user_profiles!interested_user_id(id, full_name),
        shift:shifts!inner(id, date, start_time, end_time, shift_type, status, user_id)
      `,
      )
      .eq("status", "pending")
      .eq("shift.user_id", authUser.id)
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("shift_requests")
      .select(
        `
        id, status, created_at,
        shift:shifts!shift_id(
          id, date, start_time, end_time, shift_type, status,
          user:user_profiles!user_id(id, full_name)
        )
      `,
      )
      .eq("interested_user_id", authUser.id)
      .in("status", ["pending", "accepted"])
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("exchanges")
      .select(
        `
        id, status, user_a_id, user_b_id, signed_by_user_b_at, created_at,
        shift:shifts!shift_id(id, date, start_time, end_time, shift_type, status),
        owner:user_profiles!user_a_id(id, full_name),
        requester:user_profiles!user_b_id(id, full_name)
      `,
      )
      .or(`user_a_id.eq.${authUser.id},user_b_id.eq.${authUser.id}`)
      .in("status", ["accepted", "pending_validation", "approved"])
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("notifications")
      .select("id, title, body, read, data")
      .eq("user_id", authUser.id)
      .is("resolved_at", null)
      .order("updated_at", { ascending: false })
      .limit(3),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authUser.id)
      .eq("read", false)
      .is("resolved_at", null),
  ]);

  const typedAvailableShifts: NormalizedHomeShift[] = ((
    availableShiftsResult.data ?? []
  ) as HomeShift[])
    .map(normalizeShift)
    .filter(isNormalizedHomeShift);
  const typedMyPublishedShifts: NormalizedHomeShift[] = ((
    myPublishedShifts ?? []
  ) as HomeShift[])
    .map(normalizeShift)
    .filter(isNormalizedHomeShift);
  const typedPendingProposals = (pendingProposals ?? []) as ProposalRow[];
  const typedMyRequests = (myRequests ?? []) as MyRequestRow[];
  const typedActiveExchanges = ((activeExchanges ?? []) as ExchangeRow[])
    .map((exchange) => ({
      ...exchange,
      owner: pickFirstRelation(exchange.owner),
      requester: pickFirstRelation(exchange.requester),
      shift: normalizeShift(exchange.shift),
    }))
    .filter((exchange) => Boolean(exchange.shift));
  const typedNotifications = (notifications ?? []) as HomeNotification[];

  const todaysCalendar = calendarDays?.[0] ?? null;
  const availableShiftCount = availableShiftCountResult.count ?? 0;
  const pendingSignatureCount = typedActiveExchanges.filter(
    (exchange) =>
      exchange.status === "accepted" &&
      exchange.user_b_id === authUser.id &&
      !exchange.signed_by_user_b_at,
  ).length;
  const pendingValidationCount = typedActiveExchanges.filter(
    (exchange) => exchange.status === "pending_validation",
  ).length;
  const unreadCount = unreadResult.count ?? 0;

  const priorityItems = [
    pendingSignatureCount > 0
      ? {
          description: "Hay cambios aceptados esperando tu firma.",
          href: "/exchanges",
          icon: Repeat,
          label: "Firmas pendientes",
          value: String(pendingSignatureCount),
        }
      : null,
    typedPendingProposals.length > 0
      ? {
          description: "Responde propuestas recibidas en tus publicaciones.",
          href: "/shifts/my",
          icon: ClipboardCheck,
          label: "Propuestas recibidas",
          value: String(typedPendingProposals.length),
        }
      : null,
    unreadCount > 0
      ? {
          description: "Revisa los ultimos avisos operativos.",
          href: typedNotifications[0]?.data?.action_url ?? "/home",
          icon: MessageSquare,
          label: "Notificaciones",
          value: String(unreadCount),
        }
      : null,
    !calendarDays
      ? {
          description: "No hay tipo de jornada asignado para tu area.",
          href: "/calendar",
          icon: CalendarRange,
          label: "Calendario sin configurar",
          value: "!",
        }
      : null,
  ].filter(Boolean) as Array<{
    description: string;
    href: string;
    icon: typeof CalendarDays;
    label: string;
    value: string;
  }>;

  const quickActions = [
    {
      description: "Publica un turno para intercambio.",
      href: "/shifts/new",
      icon: Plus,
      label: "Publicar turno",
    },
    {
      description: "Compara turnos abiertos.",
      href: "/shifts",
      icon: Search,
      label: "Ver tablon",
    },
    {
      description: "Consulta tu horario mensual.",
      href: "/calendar",
      icon: CalendarDays,
      label: "Calendario",
    },
    {
      description: "Continua conversaciones abiertas.",
      href: "/chat",
      icon: MessageSquare,
      label: "Chat",
    },
    canUseAdmin
      ? {
          description: "Revisa expedientes del equipo.",
          href: "/admin/exchanges",
          icon: ShieldCheck,
          label: "Aprobaciones",
        }
      : null,
  ].filter(Boolean) as Array<{
    description: string;
    href: string;
    icon: typeof CalendarDays;
    label: string;
  }>;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Inicio"
        title={`Hola, ${getFirstName(typedProfile.full_name)}`}
        description="Tu resumen operativo para decidir rapido que revisar, publicar o firmar antes de entrar al detalle."
        action={
          <>
            <Button asChild variant="outline">
              <Link href="/shifts">
                <Search className="size-4" />
                Ver tablon
              </Link>
            </Button>
            <Button asChild>
              <Link href="/shifts/new">
                <Plus className="size-4" />
                Publicar turno
              </Link>
            </Button>
          </>
        }
      />

      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        data-tour="home-summary"
      >
        <MetricCard
          description={
            todaysCalendar
              ? todaysCalendar.dayType === "rest"
                ? "Hoy figura como descanso en tu calendario."
                : "Turno previsto segun tu calendario laboral."
              : "Pendiente de configuracion por area."
          }
          icon={CalendarCheck}
          label="Hoy"
          value={
            todaysCalendar
              ? CALENDAR_DAY_TYPE_LABELS[todaysCalendar.dayType]
              : "Sin calendario"
          }
        />
        <MetricCard
          description="Turnos abiertos en tu alcance operativo."
          icon={Search}
          label="Disponibles"
          value={String(availableShiftCount)}
        />
        <MetricCard
          description="Propuestas nuevas sobre tus publicaciones."
          icon={ClipboardCheck}
          label="Por responder"
          tone={typedPendingProposals.length > 0 ? "attention" : "default"}
          value={String(typedPendingProposals.length)}
        />
        <MetricCard
          description={`${pendingValidationCount} en validacion y ${pendingSignatureCount} pendientes de firma.`}
          icon={Repeat}
          label="Cambios activos"
          tone={pendingSignatureCount > 0 ? "attention" : "default"}
          value={String(typedActiveExchanges.length)}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Card data-tour="home-priorities">
            <CardHeader>
              <SectionTitle
                title="Prioridades"
                description="Lo que puede necesitar accion antes que navegar por la app."
              />
            </CardHeader>
            <CardContent className="space-y-3">
              {priorityItems.length > 0 ? (
                priorityItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      className="group flex items-center gap-4 rounded-2xl border border-border/70 px-4 py-3 transition-colors hover:bg-secondary/45"
                      href={item.href}
                      key={item.label}
                    >
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Icon className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {item.label}
                          </p>
                          <Badge variant="outline">{item.value}</Badge>
                        </div>
                        <p className="truncate text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </Link>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/10 px-4 py-4">
                  <p className="text-sm font-semibold text-foreground">
                    Todo bajo control
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    No tienes firmas, propuestas o alertas urgentes ahora mismo.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-tour="home-open-shifts">
            <CardHeader>
              <SectionTitle
                title="Turnos para revisar"
                description="Opciones abiertas en tu alcance, ordenadas por fecha."
              />
            </CardHeader>
            <CardContent className="space-y-3">
              {typedAvailableShifts.length > 0 ? (
                typedAvailableShifts.map((shift) => (
                  <ShiftSummaryRow
                    actionLabel="Ver"
                    href={`/shifts/${shift.id}`}
                    key={shift.id}
                    shift={shift}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-border/70 px-4 py-4">
                  <p className="text-sm font-semibold text-foreground">
                    No hay turnos abiertos ahora mismo
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Puedes publicar uno propio o volver mas tarde al tablon.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-tour="home-movements">
            <CardHeader>
              <SectionTitle
                title="Mis movimientos"
                description="Publicaciones propias, solicitudes enviadas y expedientes activos."
              />
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="space-y-3 rounded-2xl border border-border/70 p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Publicaciones
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Tus turnos abiertos o en tramite.
                  </p>
                </div>
                {typedMyPublishedShifts.length > 0 ? (
                  typedMyPublishedShifts.slice(0, 3).map((shift) => {
                    const pendingCount =
                      shift.shift_requests?.filter(
                        (request) => request.status === "pending",
                      ).length ?? 0;

                    return (
                      <Link
                        className="block rounded-xl border border-border/60 px-3 py-2 transition-colors hover:bg-secondary/45"
                        href={`/shifts/${shift.id}`}
                        key={shift.id}
                      >
                        <p className="truncate text-sm font-medium text-foreground">
                          {formatShortDate(shift.date)} -{" "}
                          {SHIFT_TYPE_LABELS[shift.shift_type]}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {pendingCount} propuesta{pendingCount === 1 ? "" : "s"}
                        </p>
                      </Link>
                    );
                  })
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">
                    No tienes publicaciones futuras.
                  </p>
                )}
              </div>

              <div className="space-y-3 rounded-2xl border border-border/70 p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Solicitudes
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Propuestas que has enviado.
                  </p>
                </div>
                {typedMyRequests.length > 0 ? (
                  typedMyRequests.slice(0, 3).map((request) => {
                    const shift = normalizeShift(request.shift);

                    return (
                      <Link
                        className="block rounded-xl border border-border/60 px-3 py-2 transition-colors hover:bg-secondary/45"
                        href={shift ? `/shifts/${shift.id}` : "/exchanges"}
                        key={request.id}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={REQUEST_STATUS_STYLES[request.status]}>
                            {REQUEST_STATUS_LABELS[request.status]}
                          </Badge>
                        </div>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {shift
                            ? `${formatShortDate(shift.date)} - ${shift.user?.full_name ?? "Turno solicitado"}`
                            : "Solicitud enviada"}
                        </p>
                      </Link>
                    );
                  })
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">
                    No tienes solicitudes pendientes.
                  </p>
                )}
              </div>

              <div className="space-y-3 rounded-2xl border border-border/70 p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Cambios
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Expedientes abiertos.
                  </p>
                </div>
                {typedActiveExchanges.length > 0 ? (
                  typedActiveExchanges.slice(0, 3).map((exchange) => {
                    const shift = exchange.shift;
                    const otherUser =
                      exchange.user_a_id === authUser.id
                        ? exchange.requester
                        : exchange.owner;

                    return (
                      <Link
                        className="block rounded-xl border border-border/60 px-3 py-2 transition-colors hover:bg-secondary/45"
                        href={`/exchanges/${exchange.id}`}
                        key={exchange.id}
                      >
                        <Badge className={EXCHANGE_STATUS_STYLES[exchange.status]}>
                          {EXCHANGE_STATUS_LABELS[exchange.status]}
                        </Badge>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {shift
                            ? `${formatShortDate(shift.date)} - ${otherUser?.full_name ?? "Intercambio"}`
                            : otherUser?.full_name ?? "Intercambio"}
                        </p>
                      </Link>
                    );
                  })
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">
                    No tienes expedientes activos.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="min-w-0 space-y-6">
          <Card data-tour="home-agenda">
            <CardHeader>
              <CardTitle>Agenda proxima</CardTitle>
              <CardDescription>
                Siete dias de calendario laboral y excepciones.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {calendarDays ? (
                calendarDays.map((day) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 px-3 py-2"
                    key={day.date}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {formatAgendaDate(day.date)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {day.exchangeOverlay
                          ? "Con intercambio asociado"
                          : day.isOverride
                            ? "Ajuste manual"
                            : day.isVacation
                              ? "Vacaciones"
                              : "Planificado"}
                      </p>
                    </div>
                    <Badge
                      className={CALENDAR_DAY_TYPE_STYLES[day.dayType as CalendarDayType]}
                    >
                      {CALENDAR_DAY_TYPE_LABELS[day.dayType]}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-border/70 px-4 py-4">
                  <p className="text-sm font-semibold text-foreground">
                    Calendario pendiente
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Cuando se configure tu area, este bloque mostrara tus turnos.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-tour="home-quick-actions">
            <CardHeader>
              <CardTitle>Accesos rapidos</CardTitle>
              <CardDescription>
                Los destinos mas habituales desde el inicio.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickActions.map((action) => {
                const Icon = action.icon;

                return (
                  <Link
                    className="group flex items-center gap-3 rounded-2xl border border-border/70 px-3 py-3 transition-colors hover:bg-secondary/45"
                    href={action.href}
                    key={action.href}
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {action.label}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {action.description}
                      </p>
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
