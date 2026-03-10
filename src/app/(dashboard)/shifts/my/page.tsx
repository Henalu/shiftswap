import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
} from "@/components/ui/card";
import { Plus, CalendarDays, Users } from "lucide-react";
import {
  SHIFT_TYPE_LABELS,
  SHIFT_STATUS_LABELS,
  SHIFT_STATUS_COLORS,
  REQUEST_STATUS_LABELS,
} from "@/lib/constants";
import { formatShortDate } from "@/lib/utils";
import { acceptRequest, rejectRequest } from "./actions";
import { CancelShiftButton } from "@/components/shifts/cancel-shift-button";
import type { ShiftType, RequestStatus } from "@/types";

interface RequestWithUser {
  id: string;
  shift_id: string;
  interested_user_id: string;
  status: RequestStatus;
  created_at: string;
  requester: {
    id: string;
    email: string;
    full_name: string;
  };
}

interface ShiftWithRequests {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  shift_type: string;
  status: string;
  description: string | null;
  department: { id: string; name: string };
  shift_requests: RequestWithUser[];
}

export default async function MyShiftsPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const { data: shifts } = await supabase
    .from("shifts")
    .select(
      `
      id, date, start_time, end_time, shift_type, status, description,
      department:departments!department_id(id, name),
      shift_requests(
        id, shift_id, interested_user_id, status, created_at,
        requester:user_profiles!interested_user_id(id, email, full_name)
      )
    `
    )
    .eq("user_id", authUser.id)
    .order("date", { ascending: false });

  const typedShifts = (shifts ?? []) as unknown as ShiftWithRequests[];

  const formatTime = (time: string) => {
    if (time?.includes(":")) {
      const [h, m] = time.split(":");
      return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
    }
    return time;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Mis turnos</h1>
        <Link href="/shifts/new">
          <Button>
            <Plus className="mr-2 size-4" />
            Publicar turno
          </Button>
        </Link>
      </div>

      {typedShifts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            No has publicado ningún turno todavía.
          </p>
          <Link href="/shifts/new" className="mt-4 inline-block">
            <Button variant="outline" size="sm">
              <Plus className="mr-2 size-4" />
              Publicar tu primer turno
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {typedShifts.map((shift) => {
            const timeRange = `${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}`;
            const pendingRequests = shift.shift_requests.filter(
              (r) => r.status === "pending"
            );
            const otherRequests = shift.shift_requests.filter(
              (r) => r.status !== "pending"
            );

            return (
              <Card key={shift.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarDays className="size-4" />
                        {formatShortDate(shift.date)} · {timeRange}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary">
                          {SHIFT_TYPE_LABELS[shift.shift_type as ShiftType]}
                        </Badge>
                        <Badge
                          className={
                            SHIFT_STATUS_COLORS[
                              shift.status as keyof typeof SHIFT_STATUS_COLORS
                            ]
                          }
                        >
                          {SHIFT_STATUS_LABELS[shift.status as keyof typeof SHIFT_STATUS_LABELS]}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/shifts/${shift.id}`}>
                        <Button variant="ghost" size="sm">
                          Ver detalle
                        </Button>
                      </Link>
                      {(shift.status === "open" || shift.status === "pending") && (
                        <CancelShiftButton shiftId={shift.id} />
                      )}
                    </div>
                  </div>
                  {shift.description && (
                    <CardDescription className="mt-1">
                      {shift.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent>
                  <div className="flex items-center gap-2 mb-3 text-sm font-medium">
                    <Users className="size-4" />
                    Interesados ({shift.shift_requests.length})
                  </div>

                  {shift.shift_requests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nadie ha mostrado interés aún.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {/* Pending requests first */}
                      {pendingRequests.map((req) => (
                        <li
                          key={req.id}
                          className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-medium">{req.requester.full_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {req.requester.email}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <form action={acceptRequest}>
                              <input type="hidden" name="request_id" value={req.id} />
                              <input type="hidden" name="shift_id" value={shift.id} />
                              <Button type="submit" size="sm" variant="default">
                                Aceptar
                              </Button>
                            </form>
                            <form action={rejectRequest}>
                              <input type="hidden" name="request_id" value={req.id} />
                              <input type="hidden" name="shift_id" value={shift.id} />
                              <Button type="submit" size="sm" variant="outline">
                                Rechazar
                              </Button>
                            </form>
                          </div>
                        </li>
                      ))}

                      {/* Already-actioned requests */}
                      {otherRequests.map((req) => (
                        <li
                          key={req.id}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <div>
                            <p className="font-medium">{req.requester.full_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {req.requester.email}
                            </p>
                          </div>
                          <Badge variant="outline">
                            {REQUEST_STATUS_LABELS[req.status]}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
