import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";
import { SHIFT_TYPE_LABELS, EXCHANGE_STATUS_LABELS } from "@/lib/constants";
import { formatShortDate } from "@/lib/utils";
import type { ShiftType, ExchangeStatus } from "@/types";

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/login");

  const { data: conversations } = await supabase
    .from("conversations")
    .select(
      `
      id, shift_id, created_at, updated_at,
      participant_a:user_profiles!participant_a_id(id, full_name),
      participant_b:user_profiles!participant_b_id(id, full_name),
      messages(id, content, created_at, read, sender_id),
      shift:shifts!shift_id(id, date, shift_type, status,
        department:departments!department_id(id, name))
    `
    )
    .or(
      `participant_a_id.eq.${authUser.id},participant_b_id.eq.${authUser.id}`
    )
    .order("updated_at", { ascending: false });

  type Participant = { id: string; full_name: string };
  type RawMessage = {
    id: string;
    content: string;
    created_at: string;
    read: boolean;
    sender_id: string;
  };
  type RawShift = {
    id: string;
    date: string;
    shift_type: string;
    status: string;
    department: { id: string; name: string };
  };
  type RawConversation = {
    id: string;
    shift_id: string | null;
    updated_at: string;
    participant_a: Participant;
    participant_b: Participant;
    messages: RawMessage[];
    shift: RawShift | null;
  };

  const typedConvs = (conversations ?? []) as unknown as RawConversation[];

  // Fetch exchanges for all shift_ids present in these conversations
  const shiftIds = typedConvs
    .map((c) => c.shift_id)
    .filter((id): id is string => id !== null);

  const exchangesByShiftId = new Map<string, ExchangeStatus>();

  if (shiftIds.length > 0) {
    const { data: exchanges } = await supabase
      .from("exchanges")
      .select("shift_id, status")
      .in("shift_id", shiftIds)
      .or(`user_a_id.eq.${authUser.id},user_b_id.eq.${authUser.id}`);

    for (const ex of exchanges ?? []) {
      exchangesByShiftId.set(ex.shift_id, ex.status as ExchangeStatus);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Chat</h1>

      {typedConvs.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <MessageSquare className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-muted-foreground">
            No tienes conversaciones activas.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Muestra interés en un turno para iniciar una conversación.
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {typedConvs.map((conv) => {
            const other =
              conv.participant_a.id === authUser.id
                ? conv.participant_b
                : conv.participant_a;

            const sortedMsgs = [...conv.messages].sort(
              (a, b) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
            );
            const lastMsg = sortedMsgs[0];
            const unread = conv.messages.filter(
              (m) => !m.read && m.sender_id !== authUser.id
            ).length;

            const initials = other.full_name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            const exchangeStatus = conv.shift_id
              ? exchangesByShiftId.get(conv.shift_id)
              : undefined;

            return (
              <li key={conv.id}>
                <Link
                  href={`/chat/${conv.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <Avatar className="size-10 shrink-0">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium">{other.full_name}</p>
                      {lastMsg && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {new Date(lastMsg.created_at).toLocaleDateString(
                            "es-ES",
                            { day: "2-digit", month: "2-digit" }
                          )}
                        </span>
                      )}
                    </div>
                    {conv.shift && (
                      <p className="truncate text-xs text-muted-foreground">
                        {formatShortDate(conv.shift.date)} ·{" "}
                        {SHIFT_TYPE_LABELS[conv.shift.shift_type as ShiftType]} ·{" "}
                        {conv.shift.department.name}
                        {exchangeStatus && (
                          <> · {EXCHANGE_STATUS_LABELS[exchangeStatus]}</>
                        )}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm text-muted-foreground">
                        {lastMsg ? lastMsg.content : "Sin mensajes aún"}
                      </p>
                      {unread > 0 && (
                        <Badge className="shrink-0 size-5 justify-center rounded-full p-0 text-[11px]">
                          {unread}
                        </Badge>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
