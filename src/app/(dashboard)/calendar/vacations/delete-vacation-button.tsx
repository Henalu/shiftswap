"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteVacation } from "@/app/(dashboard)/calendar/vacations/actions";

interface DeleteVacationButtonProps {
  vacationId: string;
}

export function DeleteVacationButton({ vacationId }: DeleteVacationButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function handleClick() {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    startTransition(async () => {
      const result = await deleteVacation(vacationId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Vacaciones eliminadas.");
      }
      setConfirming(false);
    });
  }

  return (
    <Button
      variant={confirming ? "destructive" : "ghost"}
      size="sm"
      disabled={isPending}
      onClick={handleClick}
      onBlur={() => setConfirming(false)}
    >
      <Trash2 className="mr-1.5 size-3.5" />
      {confirming ? "Confirmar" : "Eliminar"}
    </Button>
  );
}
