"use client";

import { Badge } from "@/components/ui/badge";
import {
  CALENDAR_DAY_TYPE_LABELS,
  CALENDAR_DAY_TYPE_STYLES,
} from "@/lib/constants";
import type { CalendarDay } from "@/lib/calendar";
import { cn } from "@/lib/utils";

interface CalendarDateContextProps {
  day: CalendarDay;
  title: string;
  description: string;
  className?: string;
}

export function CalendarDateContext({
  day,
  title,
  description,
  className,
}: CalendarDateContextProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-secondary/35 px-4 py-4",
        className
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <Badge className={cn("shrink-0", CALENDAR_DAY_TYPE_STYLES[day.dayType])}>
          {CALENDAR_DAY_TYPE_LABELS[day.dayType]}
        </Badge>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
