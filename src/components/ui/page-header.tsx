import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-4 md:flex-row md:items-end md:justify-between",
        className
      )}
    >
      <div className="min-w-0 space-y-2">
        {eyebrow && (
          <span className="inline-flex items-center rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {eyebrow}
          </span>
        )}
        <div className="space-y-2">
          <h1 className="break-words text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-[2rem]">
            {title}
          </h1>
          {description && (
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
              {description}
            </p>
          )}
        </div>
      </div>

      {action && (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-3 md:w-auto md:justify-end">
          {action}
        </div>
      )}
    </div>
  );
}
