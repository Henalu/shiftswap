import type { ReactNode } from "react";
import { cn, PANEL_CLASSNAME } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        PANEL_CLASSNAME,
        "flex flex-col items-start gap-5 rounded-2xl border-dashed px-6 py-8 text-left",
        className
      )}
    >
      {icon && (
        <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary">
          {icon}
        </div>
      )}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
          {title}
        </h2>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
