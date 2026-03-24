"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  approveDepartmentChangeRequest,
  rejectDepartmentChangeRequest,
} from "./actions";

interface DepartmentChangeDecisionFormProps {
  requestId: string;
  employeeName: string;
  requestedDepartmentName: string;
}

export function DepartmentChangeDecisionForm({
  requestId,
  employeeName,
  requestedDepartmentName,
}: DepartmentChangeDecisionFormProps) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(
    null
  );

  async function handleApprove() {
    setPendingAction("approve");

    const formData = new FormData();
    formData.set("request_id", requestId);
    if (notes.trim()) {
      formData.set("review_notes", notes.trim());
    }

    const result = await approveDepartmentChangeRequest(formData);
    setPendingAction(null);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(
      `Cambio aprobado para ${employeeName} hacia ${requestedDepartmentName}.`
    );
    router.refresh();
  }

  async function handleReject() {
    if (!notes.trim()) {
      toast.error("Indica el motivo del rechazo antes de continuar.");
      return;
    }

    setPendingAction("reject");

    const formData = new FormData();
    formData.set("request_id", requestId);
    formData.set("review_notes", notes.trim());

    const result = await rejectDepartmentChangeRequest(formData);
    setPendingAction(null);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(
      `Cambio rechazado para ${employeeName}.`
    );
    router.refresh();
  }

  const isSubmitting = pendingAction !== null;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          Decision administrativa
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          Aprueba cuando el traslado ya pueda aplicarse en el perfil del empleado.
          Si lo rechazas, deja claro que condicion falta por cumplir.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`department-change-notes-${requestId}`}>Observaciones</Label>
        <Textarea
          id={`department-change-notes-${requestId}`}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Anade contexto para la resolucion o explica el motivo del rechazo."
          disabled={isSubmitting}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={handleApprove} disabled={isSubmitting}>
          {pendingAction === "approve" ? "Aprobando..." : "Aprobar cambio"}
        </Button>
        <Button
          variant="destructive"
          onClick={handleReject}
          disabled={isSubmitting}
        >
          {pendingAction === "reject" ? "Rechazando..." : "Rechazar cambio"}
        </Button>
      </div>
    </div>
  );
}
