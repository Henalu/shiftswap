import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRightLeft,
  CheckCircle2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { DepartmentChangeDecisionForm } from "./department-change-decision-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  DEPARTMENT_CHANGE_REQUEST_STATUS_LABELS,
  DEPARTMENT_CHANGE_REQUEST_STATUS_STYLES,
} from "@/lib/constants";
import { pickFirstRelation } from "@/lib/supabase-relations";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAccountGateState } from "@/lib/user-profiles";
import {
  canReviewDepartmentChangeRequest,
  hasAdminPanelAccess,
  USER_ROLE_LABELS,
} from "@/lib/user-roles";
import { formatShortDate } from "@/lib/utils";
import type { DepartmentChangeRequestStatus, UserRole } from "@/types";

interface DepartmentChangeRow {
  id: string;
  user_id: string;
  company_id: string;
  current_department_id: string;
  requested_department_id: string;
  request_reason: string | null;
  review_notes: string | null;
  status: DepartmentChangeRequestStatus;
  created_at: string;
  reviewed_at: string | null;
  user: {
    id: string;
    full_name: string;
    email: string;
  };
  company: {
    id: string;
    name: string;
  };
  current_department: {
    id: string;
    name: string;
  };
  requested_department: {
    id: string;
    name: string;
  };
}

export default async function AdminDepartmentChangesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const accountState = await getAccountGateState(user.id);
  if (!accountState || !hasAdminPanelAccess(accountState.role)) {
    redirect("/shifts");
  }

  const actor = {
    id: user.id,
    role: accountState.role as UserRole,
    company_id: accountState.company_id,
    department_id: accountState.department_id,
  };

  const adminClient = createAdminClient();
  const { data: requests, error } = await adminClient
    .from("department_change_requests")
    .select(
      `
      id, user_id, company_id, current_department_id, requested_department_id,
      request_reason, review_notes, status, created_at, reviewed_at,
      user:user_profiles!user_id(id, full_name, email),
      company:companies!company_id(id, name),
      current_department:departments!department_change_requests_current_department_fk(id, name),
      requested_department:departments!department_change_requests_requested_department_fk(id, name)
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error(
      "[admin/department-changes/page] Failed to load department change requests",
      error.message
    );

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Administracion"
          title="Cambios de departamento"
          description="No se ha podido cargar esta cola administrativa."
          action={
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{USER_ROLE_LABELS[actor.role]}</Badge>
              <Link href="/admin">
                <Button variant="outline">Volver al panel</Button>
              </Link>
            </div>
          }
        />

        <EmptyState
          icon={<RefreshCw className="size-5" />}
          title="No se pudieron cargar las solicitudes"
          description="Puede faltar una migracion o haber un problema temporal con la base de datos. Revisa los logs del servidor y confirma que Supabase tenga aplicadas las migraciones hasta el bloque de cambios de departamento."
        />
      </div>
    );
  }

  const normalizedRequests = ((requests ?? []) as unknown[]).map((request) => {
    const typed = request as DepartmentChangeRow & {
      user: DepartmentChangeRow["user"] | DepartmentChangeRow["user"][];
      company: DepartmentChangeRow["company"] | DepartmentChangeRow["company"][];
      current_department:
        | DepartmentChangeRow["current_department"]
        | DepartmentChangeRow["current_department"][];
      requested_department:
        | DepartmentChangeRow["requested_department"]
        | DepartmentChangeRow["requested_department"][];
    };

    return {
      ...typed,
      user: pickFirstRelation(typed.user),
      company: pickFirstRelation(typed.company),
      current_department: pickFirstRelation(typed.current_department),
      requested_department: pickFirstRelation(typed.requested_department),
    };
  });

  const scopedRequests = normalizedRequests.filter(
    (
      request
    ): request is DepartmentChangeRow & {
      user: NonNullable<DepartmentChangeRow["user"]>;
      company: NonNullable<DepartmentChangeRow["company"]>;
      current_department: NonNullable<DepartmentChangeRow["current_department"]>;
      requested_department: NonNullable<DepartmentChangeRow["requested_department"]>;
    } =>
      Boolean(request.user) &&
      Boolean(request.company) &&
      Boolean(request.current_department) &&
      Boolean(request.requested_department) &&
      request.user_id !== actor.id &&
      canReviewDepartmentChangeRequest(actor, {
        company_id: request.company_id,
        current_department_id: request.current_department_id,
        requested_department_id: request.requested_department_id,
      })
  );

  const pendingRequests = scopedRequests.filter((request) => request.status === "pending");
  const resolvedRequests = scopedRequests
    .filter((request) => request.status === "approved" || request.status === "rejected")
    .slice(0, 8);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Administracion"
        title="Cambios de departamento"
        description="Revisa y resuelve aqui las solicitudes de traslado entre departamentos operativos dentro de tu alcance."
        action={
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{USER_ROLE_LABELS[actor.role]}</Badge>
            <Link href="/admin/job-position-changes">
              <Button variant="outline">Cambios de puesto</Button>
            </Link>
            <Link href="/admin/exchanges">
              <Button variant="outline">Cambios equipo</Button>
            </Link>
          </div>
        }
      />

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
            Pendientes de revision
          </h2>
          <p className="text-sm text-muted-foreground">
            Cada solicitud mantiene el departamento actual del empleado hasta que un
            administrador la aprueba.
          </p>
        </div>

        {pendingRequests.length === 0 ? (
          <EmptyState
            icon={<RefreshCw className="size-5" />}
            title="No hay solicitudes pendientes"
            description="Cuando un empleado solicite un cambio de departamento aparecera aqui lista para revision."
          />
        ) : (
          <div className="space-y-4">
            {pendingRequests.map((request) => (
              <Card key={request.id}>
                <CardHeader className="space-y-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          className={
                            DEPARTMENT_CHANGE_REQUEST_STATUS_STYLES[request.status]
                          }
                        >
                          {DEPARTMENT_CHANGE_REQUEST_STATUS_LABELS[request.status]}
                        </Badge>
                        <Badge variant="outline">{request.company.name}</Badge>
                        <Badge variant="outline">
                          Solicitada el {formatShortDate(request.created_at)}
                        </Badge>
                      </div>

                      <div className="space-y-1">
                        <CardTitle className="text-[1.4rem]">
                          {request.user.full_name}
                        </CardTitle>
                        <CardDescription>{request.user.email}</CardDescription>
                      </div>
                    </div>

                    <Badge variant="outline">Revision administrativa</Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5">
                  <div className="rounded-2xl border border-border/75 bg-secondary/30 px-4 py-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <ArrowRightLeft className="size-4 text-primary" />
                      Movimiento solicitado
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {request.current_department.name} → {request.requested_department.name}
                    </p>
                  </div>

                  {request.request_reason ? (
                    <div className="rounded-2xl border border-border/75 bg-background/95 px-4 py-4 text-sm leading-6 text-muted-foreground">
                      <p className="mb-1 font-semibold text-foreground">
                        Motivo indicado
                      </p>
                      {request.request_reason}
                    </div>
                  ) : null}

                  <DepartmentChangeDecisionForm
                    requestId={request.id}
                    employeeName={request.user.full_name}
                    requestedDepartmentName={request.requested_department.name}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {resolvedRequests.length > 0 ? (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
              Resueltas recientemente
            </h2>
            <p className="text-sm text-muted-foreground">
              Ultimas decisiones tomadas dentro de tu alcance administrativo.
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {resolvedRequests.map((request) => (
              <Card key={request.id}>
                <CardContent className="space-y-4 pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          className={
                            DEPARTMENT_CHANGE_REQUEST_STATUS_STYLES[request.status]
                          }
                        >
                          {DEPARTMENT_CHANGE_REQUEST_STATUS_LABELS[request.status]}
                        </Badge>
                        {request.reviewed_at ? (
                          <Badge variant="outline">
                            Revisada el {formatShortDate(request.reviewed_at)}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        {request.user.full_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {request.current_department.name} → {request.requested_department.name}
                      </p>
                    </div>

                    <div
                      className={
                        request.status === "approved"
                          ? "rounded-xl bg-emerald-500/10 p-2 text-emerald-700"
                          : "rounded-xl bg-rose-500/10 p-2 text-rose-700"
                      }
                    >
                      {request.status === "approved" ? (
                        <CheckCircle2 className="size-4" />
                      ) : (
                        <XCircle className="size-4" />
                      )}
                    </div>
                  </div>

                  {request.review_notes ? (
                    <div className="rounded-2xl border border-border/75 bg-secondary/35 px-4 py-4 text-sm leading-6 text-muted-foreground">
                      <p className="mb-1 font-semibold text-foreground">
                        Observaciones
                      </p>
                      {request.review_notes}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
