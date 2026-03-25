"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, Building2, Repeat, Workflow } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DEPARTMENT_CHANGE_REQUEST_STATUS_LABELS,
  DEPARTMENT_CHANGE_REQUEST_STATUS_STYLES,
} from "@/lib/constants";
import { formatShortDate, FORM_CONTROL_CLASSNAME, PANEL_CLASSNAME, cn } from "@/lib/utils";
import type { DepartmentChangeRequestStatus, JobPosition } from "@/types";
import { requestJobPositionChange } from "./actions";

export interface ProfileJobPositionChangeRequestSummary {
  id: string;
  status: DepartmentChangeRequestStatus;
  request_reason?: string | null;
  review_notes?: string | null;
  created_at: string;
  reviewed_at?: string | null;
  currentAreaName: string;
  currentDepartmentName: string;
  currentJobPositionName: string;
  requestedJobPositionName: string;
}

interface JobPositionChangeRequestCardProps {
  companyName: string;
  currentAreaName: string;
  currentDepartmentName: string;
  currentJobPositionId: string | null;
  currentJobPositionName: string;
  jobPositions: JobPosition[];
  requests: ProfileJobPositionChangeRequestSummary[];
}

export function JobPositionChangeRequestCard({
  companyName,
  currentAreaName,
  currentDepartmentName,
  currentJobPositionId,
  currentJobPositionName,
  jobPositions,
  requests,
}: JobPositionChangeRequestCardProps) {
  const router = useRouter();
  const [requestedJobPositionId, setRequestedJobPositionId] = useState(() => {
    return (
      jobPositions.find(
        (jobPosition) =>
          jobPosition.active && jobPosition.id !== currentJobPositionId
      )?.id ?? ""
    );
  });
  const [requestReason, setRequestReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const availableJobPositions = useMemo(
    () =>
      jobPositions.filter(
        (jobPosition) =>
          jobPosition.active && jobPosition.id !== currentJobPositionId
      ),
    [currentJobPositionId, jobPositions]
  );
  const pendingRequest =
    requests.find((request) => request.status === "pending") ?? null;
  const canSubmitRequest =
    !pendingRequest &&
    availableJobPositions.length > 0 &&
    requestedJobPositionId.length > 0;

  async function handleSubmit() {
    if (!canSubmitRequest) {
      return;
    }

    setSubmitting(true);

    const formData = new FormData();
    formData.set("requested_job_position_id", requestedJobPositionId);
    if (requestReason.trim()) {
      formData.set("request_reason", requestReason.trim());
    }

    const result = await requestJobPositionChange(formData);
    setSubmitting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("La solicitud de cambio de puesto se ha enviado al equipo administrador.");
    setRequestReason("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle>Solicitud de cambio de puesto</CardTitle>
            <CardDescription>
              Tu puesto actual se mantiene hasta que una persona administradora
              aprueba el cambio. Desde aqui solicitas otro puesto valido dentro
              de tu departamento operativo.
            </CardDescription>
          </div>
          {pendingRequest ? (
            <Badge className={DEPARTMENT_CHANGE_REQUEST_STATUS_STYLES.pending}>
              Solicitud pendiente
            </Badge>
          ) : (
            <Badge variant="outline">Con aprobacion previa</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className={cn(PANEL_CLASSNAME, "space-y-2 px-4 py-4")}>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Building2 className="size-4 text-primary" />
              Empresa
            </div>
            <p className="text-sm text-muted-foreground">{companyName}</p>
          </div>
          <div className={cn(PANEL_CLASSNAME, "space-y-2 px-4 py-4")}>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Workflow className="size-4 text-primary" />
              Area o taller
            </div>
            <p className="text-sm text-muted-foreground">{currentAreaName}</p>
          </div>
          <div className={cn(PANEL_CLASSNAME, "space-y-2 px-4 py-4")}>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Repeat className="size-4 text-primary" />
              Departamento
            </div>
            <p className="text-sm text-muted-foreground">{currentDepartmentName}</p>
          </div>
          <div className={cn(PANEL_CLASSNAME, "space-y-2 px-4 py-4")}>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <BriefcaseBusiness className="size-4 text-primary" />
              Puesto actual
            </div>
            <p className="text-sm text-muted-foreground">{currentJobPositionName}</p>
          </div>
        </div>

        <div className="space-y-5 rounded-2xl border border-border/70 bg-secondary/20 p-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              Nuevo puesto solicitado
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              Solo puedes elegir puestos activos del departamento al que ya
              perteneces. El cambio no se aplica automaticamente desde esta
              pantalla.
            </p>
          </div>

          {pendingRequest ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-sm leading-6 text-amber-900">
              Ya tienes una solicitud pendiente para pasar de{" "}
              <span className="font-semibold">
                {pendingRequest.currentJobPositionName}
              </span>{" "}
              a{" "}
              <span className="font-semibold">
                {pendingRequest.requestedJobPositionName}
              </span>
              . Espera la resolucion antes de abrir una nueva.
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="change-requested-job-position">
                  Puesto de trabajo solicitado
                </Label>
                <select
                  id="change-requested-job-position"
                  value={requestedJobPositionId}
                  onChange={(event) => setRequestedJobPositionId(event.target.value)}
                  disabled={submitting || availableJobPositions.length === 0}
                  className={FORM_CONTROL_CLASSNAME}
                >
                  {availableJobPositions.length === 0 ? (
                    <option value="">Sin puestos disponibles</option>
                  ) : null}
                  {availableJobPositions.map((jobPosition) => (
                    <option key={jobPosition.id} value={jobPosition.id}>
                      {jobPosition.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="job-position-change-reason">Motivo o contexto</Label>
                <Textarea
                  id="job-position-change-reason"
                  value={requestReason}
                  onChange={(event) => setRequestReason(event.target.value)}
                  placeholder="Ejemplo: he completado la formación requerida para asumir este puesto."
                  disabled={submitting}
                />
                <p className="text-sm leading-6 text-muted-foreground">
                  Puedes añadir contexto para facilitar la revision, aunque el
                  motivo es opcional si ya existe una justificacion interna.
                </p>
              </div>

              {availableJobPositions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ahora mismo no hay otros puestos activos disponibles dentro de
                  tu departamento operativo.
                </p>
              ) : null}

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmitRequest || submitting}
                >
                  {submitting ? "Enviando solicitud..." : "Solicitar cambio"}
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              Historial de solicitudes
            </p>
            <p className="text-sm text-muted-foreground">
              Revisa aqui el estado de tus ultimas peticiones de cambio de puesto.
            </p>
          </div>

          {requests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-secondary/25 px-4 py-6 text-sm text-muted-foreground">
              Aun no has solicitado ningun cambio de puesto de trabajo.
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-2xl border border-border/75 bg-background/95 p-4"
                >
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
                        <Badge variant="outline">
                          Solicitada el {formatShortDate(request.created_at)}
                        </Badge>
                        {request.reviewed_at ? (
                          <Badge variant="outline">
                            Revisada el {formatShortDate(request.reviewed_at)}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        {request.currentAreaName} · {request.currentDepartmentName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {request.currentJobPositionName} →{" "}
                        {request.requestedJobPositionName}
                      </p>
                      {request.request_reason ? (
                        <p className="text-sm leading-6 text-muted-foreground">
                          {request.request_reason}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {request.review_notes ? (
                    <div className="mt-4 rounded-2xl border border-border/70 bg-secondary/35 px-4 py-3 text-sm leading-6 text-muted-foreground">
                      <p className="mb-1 font-semibold text-foreground">
                        Observaciones
                      </p>
                      {request.review_notes}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
