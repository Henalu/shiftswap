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
  const proposalAccepted = true; // Always true once exchange exists
  const signatureComplete =
    status === "pending_validation" ||
    status === "approved" ||
    status === "rejected" ||
    status === "completed";
  const notificationComplete =
    status === "approved" || status === "rejected" || status === "completed";
  const resolvedComplete =
    status === "approved" ||
    status === "rejected" ||
    status === "completed" ||
    status === "cancelled";

  return [
    {
      key: "proposal",
      label: "Propuesta aceptada",
      description: "El propietario acepta una propuesta de intercambio.",
      state: proposalAccepted ? "complete" : "current",
    },
    {
      key: "signature",
      label: "Segunda firma",
      description: "El solicitante acepta y firma el acuerdo dentro de la app.",
      state: signatureComplete
        ? "complete"
        : status === "accepted"
          ? "current"
          : "upcoming",
    },
    {
      key: "notification",
      label: "Responsable informado",
      description: "La app avisa al responsable sin pedir aprobacion.",
      state: notificationComplete
        ? "complete"
        : status === "pending_validation"
          ? "current"
          : "upcoming",
    },
    {
      key: "resolution",
      label: "Cierre",
      description: "El expediente queda aceptado, cancelado o caducado.",
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
