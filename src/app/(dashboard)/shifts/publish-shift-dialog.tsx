"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, Loader2, Plus } from "lucide-react";
import { ShiftForm } from "@/app/(dashboard)/shifts/new/shift-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PANEL_CLASSNAME, cn } from "@/lib/utils";
import {
  getPublishShiftFormData,
  type PublishShiftFormData,
  type PublishShiftFormResult,
} from "./publish-shift-dialog-actions";

interface PublishShiftDialogProps {
  label?: string;
  variant?: "default" | "outline";
}

export function PublishShiftDialog({
  label = "Publicar turno",
  variant = "default",
}: PublishShiftDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<PublishShiftFormData | null>(null);
  const [errorResult, setErrorResult] = useState<
    Extract<PublishShiftFormResult, { success: false }> | null
  >(null);

  async function loadFormData() {
    if (loading || formData) {
      return;
    }

    setLoading(true);
    setErrorResult(null);

    try {
      const result = await getPublishShiftFormData();

      if (result.success) {
        setFormData(result.data);
        return;
      }

      setErrorResult(result);
    } catch {
      setErrorResult({
        success: false,
        error:
          "No hemos podido preparar el formulario. Reintentalo en unos segundos.",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (nextOpen) {
      void loadFormData();
      return;
    }

    setErrorResult(null);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button type="button" variant={variant} onClick={() => handleOpenChange(true)}>
        <Plus className="size-4" />
        {label}
      </Button>

      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto border-0 bg-transparent p-0 shadow-none sm:w-full sm:rounded-xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Publicar nuevo turno</DialogTitle>
          <DialogDescription>
            Formulario para publicar un turno desde el tablon.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div
            className={cn(
              PANEL_CLASSNAME,
              "flex min-h-64 flex-col items-center justify-center gap-4 p-6 text-center",
            )}
          >
            <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
            <div className="space-y-2">
              <p className="text-base font-semibold text-foreground">
                Preparando el formulario
              </p>
              <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                Estamos cargando tu calendario y datos de publicacion.
              </p>
            </div>
          </div>
        )}

        {!loading && errorResult && (
          <div className={cn(PANEL_CLASSNAME, "space-y-5 p-6")}>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                <AlertCircle className="size-5" aria-hidden="true" />
              </span>
              <div className="space-y-2">
                <p className="text-base font-semibold text-foreground">
                  No se puede publicar todavia
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {errorResult.error}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setErrorResult(null);
                  void loadFormData();
                }}
              >
                Reintentar
              </Button>
              {errorResult.actionHref && errorResult.actionLabel ? (
                <Button asChild>
                  <Link href={errorResult.actionHref}>
                    {errorResult.actionLabel}
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        )}

        {!loading && formData && (
          <ShiftForm
            key={open ? "publish-shift-form-open" : "publish-shift-form-closed"}
            departments={formData.departments}
            jobPositions={formData.jobPositions}
            defaultDepartmentId={formData.defaultDepartmentId}
            defaultJobPositionId={formData.defaultJobPositionId}
            calendarDays={formData.calendarDays}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
