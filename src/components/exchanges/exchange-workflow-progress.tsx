import { Check, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExchangeStatus } from "@/types";

interface ExchangeWorkflowProgressProps {
  status: ExchangeStatus;
}

interface WorkflowStep {
  key: string;
  label: string;
  description: string;
  state: "complete" | "current" | "upcoming";
}

function getWorkflowSteps(status: ExchangeStatus): WorkflowStep[] {
  const agreementComplete = status !== "pending_confirmation";
  const signaturesComplete =
    status === "pending_department_approval" ||
    status === "approved" ||
    status === "rejected" ||
    status === "completed";
  const approvalComplete =
    status === "approved" || status === "rejected" || status === "completed";
  const resolvedComplete =
    status === "approved" ||
    status === "rejected" ||
    status === "completed" ||
    status === "cancelled";

  return [
    {
      key: "agreement",
      label: "Acuerdo",
      description: "Ambas personas aceptan negociar el cambio.",
      state: agreementComplete ? "complete" : "current",
    },
    {
      key: "signatures",
      label: "Firmas",
      description: "La solicitud formal se firma dentro de la app.",
      state: signaturesComplete
        ? "complete"
        : status === "confirmed"
          ? "current"
          : "upcoming",
    },
    {
      key: "approval",
      label: "Aprobacion",
      description: "El responsable del departamento revisa y decide.",
      state: approvalComplete
        ? "complete"
        : status === "pending_department_approval"
          ? "current"
          : "upcoming",
    },
    {
      key: "resolution",
      label: "Resolucion",
      description: "El expediente queda aprobado, rechazado o cancelado.",
      state: resolvedComplete ? "complete" : "upcoming",
    },
  ];
}

export function ExchangeWorkflowProgress({
  status,
}: ExchangeWorkflowProgressProps) {
  const steps = getWorkflowSteps(status);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {steps.map((step, index) => {
        const isComplete = step.state === "complete";
        const isCurrent = step.state === "current";

        return (
          <div
            key={step.key}
            className={cn(
              "rounded-2xl border px-4 py-4 transition-colors",
              isComplete
                ? "border-emerald-500/20 bg-emerald-500/8"
                : isCurrent
                  ? "border-primary/20 bg-primary/6"
                  : "border-border/70 bg-secondary/35"
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold",
                  isComplete
                    ? "bg-emerald-500/12 text-emerald-700"
                    : isCurrent
                      ? "bg-primary/12 text-primary"
                      : "bg-background text-muted-foreground"
                )}
              >
                {isComplete ? (
                  <Check className="size-4" />
                ) : isCurrent ? (
                  <Clock3 className="size-4" />
                ) : (
                  index + 1
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{step.label}</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
