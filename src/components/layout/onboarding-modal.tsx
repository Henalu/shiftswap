"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PenLine, CircleHelp, CalendarDays } from "lucide-react";
import { completeOnboarding } from "@/app/(dashboard)/onboarding-actions";

export function OnboardingModal() {
  const [open, setOpen] = useState(true);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleClose = useCallback(async () => {
    if (dontShowAgain) {
      setSaving(true);
      await completeOnboarding();
      setSaving(false);
    }
    setOpen(false);
  }, [dontShowAgain]);

  return (
    <Dialog open={open} onOpenChange={(value) => !value && handleClose()}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl">
            Bienvenido a ShiftSwap
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Todo lo que necesitas para gestionar cambios de turno con tus
            companeros, en un solo lugar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-2">
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-3.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <PenLine className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Configura tu firma digital
                </p>
                <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                  Es obligatoria para publicar turnos, proponer cambios y firmar
                  acuerdos.{" "}
                  <Link
                    href="/profile"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                    onClick={() => setOpen(false)}
                  >
                    Ir a Mi perfil
                  </Link>
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-3.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CalendarDays className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Publica o busca turnos
                </p>
                <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                  Publica los turnos que quieras intercambiar o explora los de
                  otros companeros en el Tablon.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-3.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CircleHelp className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Consulta la ayuda
                </p>
                <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                  Si tienes dudas, revisa la seccion de{" "}
                  <Link
                    href="/help"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                    onClick={() => setOpen(false)}
                  >
                    Ayuda
                  </Link>{" "}
                  donde explicamos cada paso.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border/60 px-6 py-4 mt-4">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="size-4 rounded border-border accent-primary"
            />
            No volver a mostrar
          </label>
          <Button onClick={handleClose} disabled={saving} size="sm">
            {saving ? "Guardando..." : "Entendido"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
