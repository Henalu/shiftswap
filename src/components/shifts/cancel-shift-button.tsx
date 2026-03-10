"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cancelShift } from "@/app/(dashboard)/shifts/my/actions";

interface CancelShiftButtonProps {
  shiftId: string;
}

export function CancelShiftButton({ shiftId }: CancelShiftButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    const formData = new FormData();
    formData.set("shift_id", shiftId);
    startTransition(() => cancelShift(formData));
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={isPending}>
          {isPending ? "Cancelando..." : "Cancelar turno"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Cancelar este turno?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción cancelará el turno y notificará a los interesados. No
            se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Volver</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            Sí, cancelar turno
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
