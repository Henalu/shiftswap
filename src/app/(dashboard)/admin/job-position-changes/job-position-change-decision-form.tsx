"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  approveJobPositionChangeRequest,
  rejectJobPositionChangeRequest,
} from "./actions";

interface JobPositionChangeDecisionFormProps {
  requestId: string;
  employeeName: string;
  requestedJobPositionName: string;
}

export function JobPositionChangeDecisionForm({
  requestId,
  employeeName,
  requestedJobPositionName,
}: JobPositionChangeDecisionFormProps) {
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

    const result = await approveJobPositionChangeRequest(formData);
    setPendingAction(null);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(
      `Cambio aprobado para ${employeeName} hacia ${requestedJobPositionName}.`
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

    const result = await rejectJobPositionChangeRequest(formData);
    setPendingAction(null);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(`Cambio rechazado para ${employeeName}.`);
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
          Aprueba cuando el nuevo puesto ya pueda reflejarse en el perfil del
          empleado. Si lo rechazas, explica que condicion falta por cumplir.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`job-position-change-notes-${requestId}`}>
          Observaciones
        </Label>
        <Textarea
          id={`job-position-change-notes-${requestId}`}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Añade contexto para la resolución o explica el motivo del rechazo."
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
