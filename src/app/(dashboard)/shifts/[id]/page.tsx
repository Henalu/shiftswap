import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InterestButton } from "@/components/shifts/interest-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  SHIFT_TYPE_LABELS,
  SHIFT_STATUS_LABELS,
  SHIFT_STATUS_COLORS,
  REQUEST_STATUS_LABELS,
} from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { startConversation } from "@/app/(dashboard)/chat/actions";
import type { ShiftWithUser, ShiftRequestWithUser } from "@/types";
import type { ShiftType } from "@/types";
import { ArrowLeft, MessageSquare } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ShiftDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const { data: shiftData } = await supabase
    .from("shifts")
    .select(
      `
      *,
      user:user_profiles!user_id(id, email, full_name, avatar_url, department_id, company_id),
      department:departments!department_id(id, name)
    `
    )
    .eq("id", id)
    .single();

  if (!shiftData) {
    notFound();
  }

  const shift = {
    ...shiftData,
    user: shiftData.user,
    department: shiftData.department,
  } as ShiftWithUser;

  const { data: requests } = await supabase
    .from("shift_requests")
    .select(
      `
      *,
      user:user_profiles!interested_user_id(id, email, full_name)
    `
    )
    .eq("shift_id", id)
    .order("created_at", { ascending: false });

  const typedRequests = (requests ?? []).map((r) => ({
    ...r,
    user: r.user,
  })) as ShiftRequestWithUser[];

  const formatTimeDisplay = (time: string) => {
    if (time && time.includes(":")) {
      const parts = time.split(":");
      return `${parts[0].padStart(2, "0")}:${parts[1]?.padStart(2, "0") || "00"}`;
    }
    return time;
  };

  const timeRange = `${formatTimeDisplay(shift.start_time)} - ${formatTimeDisplay(shift.end_time)}`;
  const isOwner = authUser?.id === shift.user_id;
  const showInterestButton = !isOwner && shift.status === "open";

  // Show "Enviar mensaje" if the current user has any request on this shift
  const myRequest = authUser
    ? typedRequests.find((r) => r.user.id === authUser.id)
    : null;
  const showMessageButton = !isOwner && !!myRequest;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/shifts">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Detalle del turno
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
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
            <CardTitle>{formatDate(shift.date)}</CardTitle>
            <CardDescription>{timeRange}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Publicado por
              </p>
              <p className="font-medium">{shift.user.full_name}</p>
              <p className="text-sm text-muted-foreground">
                {shift.user.email} · {shift.department.name}
              </p>
            </div>
            {shift.description && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Descripción
                </p>
                <p className="text-sm">{shift.description}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {showInterestButton && <InterestButton shiftId={shift.id} />}
              {showMessageButton && (
                <form action={startConversation}>
                  <input type="hidden" name="shift_id" value={shift.id} />
                  <input
                    type="hidden"
                    name="other_user_id"
                    value={shift.user_id}
                  />
                  <Button type="submit" variant="outline">
                    <MessageSquare className="mr-2 size-4" />
                    Enviar mensaje
                  </Button>
                </form>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Interesados</CardTitle>
            <CardDescription>
              Personas que han mostrado interés en este turno
            </CardDescription>
          </CardHeader>
          <CardContent>
            {typedRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nadie ha mostrado interés aún.
              </p>
            ) : (
              <ul className="space-y-3">
                {typedRequests.map((req) => (
                  <li
                    key={req.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{req.user.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {req.user.email}
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
      </div>
    </div>
  );
}
