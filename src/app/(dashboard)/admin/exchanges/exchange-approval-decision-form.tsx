"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  approveExchangeRequest,
  rejectExchangeRequest,
} from "./actions";

interface ExchangeApprovalDecisionFormProps {
  exchangeId: string;
  requesterName: string;
  ownerName: string;
}

export function ExchangeApprovalDecisionForm({
  exchangeId,
  requesterName,
  ownerName,
}: ExchangeApprovalDecisionFormProps) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(
    null
  );

  async function handleApprove() {
    setPendingAction("approve");

    const formData = new FormData();
    formData.set("exchange_id", exchangeId);
    if (notes.trim()) {
      formData.set("approval_notes", notes.trim());
    }

    const result = await approveExchangeRequest(formData);
    setPendingAction(null);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(
      `Cambio aprobado para ${ownerName} y ${requesterName}.`
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
    formData.set("exchange_id", exchangeId);
    formData.set("rejection_notes", notes.trim());

    const result = await rejectExchangeRequest(formData);
    setPendingAction(null);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(
      `Cambio rechazado para ${ownerName} y ${requesterName}.`
    );
    router.refresh();
  }

  const isSubmitting = pendingAction !== null;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          Decision del departamento
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          Aprueba si el cambio puede ejecutarse tal como esta. Si lo rechazas,
          deja claro que condicion no se cumple o que debe corregirse.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="exchange-review-notes">Observaciones</Label>
        <Textarea
          id="exchange-review-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Añade contexto para la resolucion o explica el motivo del rechazo."
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
