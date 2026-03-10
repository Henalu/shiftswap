import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { SHIFT_TYPE_LABELS, SHIFT_STATUS_LABELS, SHIFT_STATUS_COLORS } from "@/lib/constants";
import { formatShortDate } from "@/lib/utils";
import type { ShiftWithUser } from "@/types";
import type { ShiftType } from "@/types";
import { InterestButton } from "./interest-button";
import { CalendarDays } from "lucide-react";

interface ShiftCardProps {
  shift: ShiftWithUser;
  currentUserId: string | null;
}

export function ShiftCard({ shift, currentUserId }: ShiftCardProps) {
  const isOwner = currentUserId === shift.user_id;
  const showInterestButton = !isOwner && shift.status === "open";

  const formatTimeDisplay = (time: string) => {
    if (time.includes(":")) {
      const [h, m] = time.split(":");
      return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
    }
    return time;
  };

  const timeRange = `${formatTimeDisplay(shift.start_time)} - ${formatTimeDisplay(shift.end_time)}`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="size-4" />
            {formatShortDate(shift.date)}
          </div>
          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary">
              {SHIFT_TYPE_LABELS[shift.shift_type as ShiftType]}
            </Badge>
            <Badge
              className={
                SHIFT_STATUS_COLORS[shift.status as keyof typeof SHIFT_STATUS_COLORS]
              }
            >
              {SHIFT_STATUS_LABELS[shift.status]}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Link
          href={`/shifts/${shift.id}`}
          className="block space-y-2 hover:opacity-90"
        >
          <p className="font-medium">{timeRange}</p>
          <p className="text-sm text-muted-foreground">
            {shift.user.full_name} · {shift.department.name}
          </p>
          {shift.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {shift.description}
            </p>
          )}
        </Link>
      </CardContent>
      {showInterestButton && (
        <CardFooter>
          <InterestButton shiftId={shift.id} />
        </CardFooter>
      )}
    </Card>
  );
}
