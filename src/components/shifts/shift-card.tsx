import Link from "next/link";
import { ArrowRight, CalendarDays, MessageSquare, UserRound } from "lucide-react";
import { startConversation } from "@/app/(dashboard)/chat/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  SHIFT_STATUS_LABELS,
  SHIFT_STATUS_STYLES,
  SHIFT_TYPE_LABELS,
  SHIFT_TYPE_STYLES,
} from "@/lib/constants";
import { formatShortDate, formatTimeRange } from "@/lib/utils";
import type { ShiftType, ShiftWithUser } from "@/types";

interface ShiftCardProps {
  shift: ShiftWithUser;
  currentUserId: string | null;
  hasActiveProposal?: boolean;
}

export function ShiftCard({
  shift,
  currentUserId,
  hasActiveProposal = false,
}: ShiftCardProps) {
  const isOwner = currentUserId === shift.user_id;
  const timeRange = formatTimeRange(shift.start_time, shift.end_time);
  const coverageTimeRange =
    shift.coverage_start_time && shift.coverage_end_time
      ? formatTimeRange(shift.coverage_start_time, shift.coverage_end_time)
      : null;

  return (
    <Card className="h-full border-border/75 transition-[border-color,box-shadow] hover:border-primary/20 hover:shadow-[0_1px_2px_rgba(15,23,42,0.05),0_24px_40px_-26px_rgba(37,99,235,0.25)]">
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <CalendarDays className="size-3.5" />
              {formatShortDate(shift.date)}
            </div>
            <CardTitle className="text-[1.4rem] leading-tight">{timeRange}</CardTitle>
          </div>
          <Badge className={SHIFT_STATUS_STYLES[shift.status]}>
            {SHIFT_STATUS_LABELS[shift.status]}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge className={SHIFT_TYPE_STYLES[shift.shift_type as ShiftType]}>
            {SHIFT_TYPE_LABELS[shift.shift_type as ShiftType]}
          </Badge>
          {coverageTimeRange ? (
            <Badge variant="outline" className="text-foreground">
              Cobertura {coverageTimeRange}
            </Badge>
          ) : null}
          <Badge variant="outline" className="text-foreground">
            {shift.department.name}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-border/70 bg-secondary/55 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-background text-primary shadow-sm">
              <UserRound className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {shift.user.full_name}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                Publicado desde {shift.department.name}
              </p>
            </div>
          </div>
        </div>

        {shift.description ? (
          <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
            {shift.description}
          </p>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            Sin notas adicionales. Puedes abrir el detalle para ver el contexto del
            turno y actuar rapido.
          </p>
        )}
      </CardContent>

      <CardFooter className="mt-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/shifts/${shift.id}`}>
              Ver detalle
              <ArrowRight className="size-4" />
            </Link>
          </Button>

          {!isOwner && (
            <form action={startConversation}>
              <input type="hidden" name="shift_id" value={shift.id} />
              <input type="hidden" name="other_user_id" value={shift.user_id} />
              <Button type="submit" variant="outline" size="sm">
                <MessageSquare className="size-4" />
                Abrir chat
              </Button>
            </form>
          )}
        </div>

        {!isOwner && hasActiveProposal && (
          <Badge className="border-sky-500/15 bg-sky-500/10 text-sky-700">
            Propuesta enviada
          </Badge>
        )}
      </CardFooter>
    </Card>
  );
}
