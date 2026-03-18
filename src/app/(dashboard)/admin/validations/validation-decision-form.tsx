"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { approveUser, rejectUser } from "./actions";

interface ValidationDecisionFormProps {
  userId: string;
  fullName: string;
}

export function ValidationDecisionForm({
  userId,
  fullName,
}: ValidationDecisionFormProps) {
  const router = useRouter();
  const [rejectionNotes, setRejectionNotes] = useState("");
  const [pendingAction, setPendingAction] = useState<
    "approve" | "reject" | null
  >(null);

  async function handleApprove() {
    setPendingAction("approve");

    const formData = new FormData();
    formData.set("user_id", userId);

    const result = await approveUser(formData);
    setPendingAction(null);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(`Cuenta aprobada para ${fullName}.`);
    router.push("/admin/validations");
    router.refresh();
  }

  async function handleReject() {
    if (!rejectionNotes.trim()) {
      toast.error("Indica el motivo del rechazo antes de continuar.");
      return;
    }

    setPendingAction("reject");

    const formData = new FormData();
    formData.set("user_id", userId);
    formData.set("validation_notes", rejectionNotes.trim());

    const result = await rejectUser(formData);
    setPendingAction(null);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(`Cuenta rechazada para ${fullName}.`);
    router.push("/admin/validations");
    router.refresh();
  }

  const isSubmitting = pendingAction !== null;

  return (
    <div className="space-y-4 border-t pt-6">
      <div className="space-y-2">
        <Label htmlFor="validation_notes">Motivo de rechazo</Label>
        <Textarea
          id="validation_notes"
          value={rejectionNotes}
          onChange={(event) => setRejectionNotes(event.target.value)}
          placeholder="Explica al empleado qué dato debe corregir o completar."
          disabled={isSubmitting}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={handleApprove} disabled={isSubmitting}>
          {pendingAction === "approve" ? "Aprobando..." : "Aprobar"}
        </Button>
        <Button
          variant="destructive"
          onClick={handleReject}
          disabled={isSubmitting}
        >
          {pendingAction === "reject" ? "Rechazando..." : "Rechazar"}
        </Button>
      </div>
    </div>
  );
}
