"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Repeat, Workflow } from "lucide-react";
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
import {
  getOperationalDepartmentsForArea,
  getTopLevelDepartmentsForCompany,
} from "@/lib/departments";
import { formatShortDate, FORM_CONTROL_CLASSNAME, PANEL_CLASSNAME, cn } from "@/lib/utils";
import type { Department, DepartmentChangeRequestStatus } from "@/types";
import { requestDepartmentChange } from "./actions";

export interface ProfileDepartmentChangeRequestSummary {
  id: string;
  status: DepartmentChangeRequestStatus;
  request_reason?: string | null;
  review_notes?: string | null;
  created_at: string;
  reviewed_at?: string | null;
  currentAreaName: string;
  currentDepartmentName: string;
  requestedAreaName: string;
  requestedDepartmentName: string;
}

interface DepartmentChangeRequestCardProps {
  companyName: string;
  currentDepartmentId: string;
  currentAreaName: string;
  currentDepartmentName: string;
  departments: Department[];
  requests: ProfileDepartmentChangeRequestSummary[];
}

export function DepartmentChangeRequestCard({
  companyName,
  currentDepartmentId,
  currentAreaName,
  currentDepartmentName,
  departments,
  requests,
}: DepartmentChangeRequestCardProps) {
  const router = useRouter();

  function getInitialSelection() {
    const availableAreas = getTopLevelDepartmentsForCompany(
      departments,
      departments[0]?.company_id ?? ""
    );

    for (const area of availableAreas) {
      const options = getOperationalDepartmentsForArea(
        departments,
        area.company_id,
        area.id
      ).filter((department) => department.id !== currentDepartmentId);

      if (options.length > 0) {
        return {
          areaDepartmentId: area.id,
          requestedDepartmentId: options[0].id,
        };
      }
    }

    return {
      areaDepartmentId: availableAreas[0]?.id ?? "",
      requestedDepartmentId: "",
    };
  }

  const initialSelection = getInitialSelection();
  const [areaDepartmentId, setAreaDepartmentId] = useState(
    initialSelection.areaDepartmentId
  );
  const [requestedDepartmentId, setRequestedDepartmentId] = useState(
    initialSelection.requestedDepartmentId
  );
  const [requestReason, setRequestReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const availableAreas = getTopLevelDepartmentsForCompany(
    departments,
    departments[0]?.company_id ?? ""
  );
  const availableDepartments = getOperationalDepartmentsForArea(
    departments,
    departments[0]?.company_id ?? "",
    areaDepartmentId
  ).filter((department) => department.id !== currentDepartmentId);
  const pendingRequest =
    requests.find((request) => request.status === "pending") ?? null;
  const canSubmitRequest =
    !pendingRequest &&
    availableAreas.length > 0 &&
    availableDepartments.length > 0 &&
    requestedDepartmentId.length > 0;

  function handleAreaChange(nextAreaDepartmentId: string) {
    setAreaDepartmentId(nextAreaDepartmentId);
    setRequestedDepartmentId(
      getOperationalDepartmentsForArea(
        departments,
        departments[0]?.company_id ?? "",
        nextAreaDepartmentId
      ).filter((department) => department.id !== currentDepartmentId)[0]?.id ?? ""
    );
  }

  async function handleSubmit() {
    if (!canSubmitRequest) {
      return;
    }

    setSubmitting(true);

    const formData = new FormData();
    formData.set("area_department_id", areaDepartmentId);
    formData.set("requested_department_id", requestedDepartmentId);
    if (requestReason.trim()) {
      formData.set("request_reason", requestReason.trim());
    }

    const result = await requestDepartmentChange(formData);
    setSubmitting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("La solicitud de cambio se ha enviado al equipo administrador.");
    setRequestReason("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle>Solicitud de cambio de departamento</CardTitle>
            <CardDescription>
              Tu asignacion actual solo cambia tras aprobacion administrativa. Desde
              aqui puedes solicitar el traslado a otro departamento operativo.
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
        <div className="grid gap-4 sm:grid-cols-3">
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
              Area actual
            </div>
            <p className="text-sm text-muted-foreground">{currentAreaName}</p>
          </div>
          <div className={cn(PANEL_CLASSNAME, "space-y-2 px-4 py-4")}>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Repeat className="size-4 text-primary" />
              Departamento actual
            </div>
            <p className="text-sm text-muted-foreground">{currentDepartmentName}</p>
          </div>
        </div>

        <div className="space-y-5 rounded-2xl border border-border/70 bg-secondary/20 p-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              Nuevo destino solicitado
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              Elige primero el area o taller y despues el departamento operativo de
              destino. No se aplica ningun cambio automatico desde esta pantalla.
            </p>
          </div>

          {pendingRequest ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-sm leading-6 text-amber-900">
              Ya tienes una solicitud pendiente para pasar de{" "}
              <span className="font-semibold">{pendingRequest.currentDepartmentName}</span>{" "}
              a{" "}
              <span className="font-semibold">
                {pendingRequest.requestedDepartmentName}
              </span>
              . Espera la resolucion antes de abrir una nueva.
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="change-area-department">Area o taller</Label>
                  <select
                    id="change-area-department"
                    value={areaDepartmentId}
                    onChange={(event) => handleAreaChange(event.target.value)}
                    disabled={submitting || availableAreas.length === 0}
                    className={FORM_CONTROL_CLASSNAME}
                  >
                    {availableAreas.length === 0 ? (
                      <option value="">Sin areas disponibles</option>
                    ) : null}
                    {availableAreas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="change-requested-department">
                    Departamento operativo
                  </Label>
                  <select
                    id="change-requested-department"
                    value={requestedDepartmentId}
                    onChange={(event) => setRequestedDepartmentId(event.target.value)}
                    disabled={submitting || availableDepartments.length === 0}
                    className={FORM_CONTROL_CLASSNAME}
                  >
                    {availableDepartments.length === 0 ? (
                      <option value="">Sin destinos disponibles</option>
                    ) : null}
                    {availableDepartments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="department-change-reason">Motivo o contexto</Label>
                <Textarea
                  id="department-change-reason"
                  value={requestReason}
                  onChange={(event) => setRequestReason(event.target.value)}
                  placeholder="Ejemplo: he aprobado la formacion necesaria para pasar a mantenimiento electrico."
                  disabled={submitting}
                />
                <p className="text-sm leading-6 text-muted-foreground">
                  Este texto ayuda al administrador a entender el cambio, pero es
                  opcional si ya existe contexto previo.
                </p>
              </div>

              {availableDepartments.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Ahora mismo no hay otro departamento operativo disponible dentro del
                  area seleccionada.
                </p>
              )}

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
              Revisa aqui el estado de tus ultimas peticiones de cambio.
            </p>
          </div>

          {requests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-secondary/25 px-4 py-6 text-sm text-muted-foreground">
              Aun no has solicitado ningun cambio de departamento.
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
                        {request.currentAreaName} · {request.currentDepartmentName} →{" "}
                        {request.requestedAreaName} · {request.requestedDepartmentName}
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
