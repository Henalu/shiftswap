import Link from "next/link";
import { redirect } from "next/navigation";
import { SearchX } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  EXCHANGE_STATUS_LABELS,
  EXCHANGE_STATUS_STYLES,
  SHIFT_TYPE_LABELS,
} from "@/lib/constants";
import { formatRelativeTime, formatShortDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import type { ExchangeStatus, ShiftType } from "@/types";

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
  const shiftIds = typedConvs
    .map((conversation) => conversation.shift_id)
    .filter((id): id is string => id !== null);

  const exchangesByShiftId = new Map<string, ExchangeStatus>();

  if (shiftIds.length > 0) {
    const { data: exchanges } = await supabase
      .from("exchanges")
      .select("shift_id, status")
      .in("shift_id", shiftIds)
      .or(`user_a_id.eq.${authUser.id},user_b_id.eq.${authUser.id}`);

    for (const exchange of exchanges ?? []) {
      exchangesByShiftId.set(exchange.shift_id, exchange.status as ExchangeStatus);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Negociacion"
        title="Chat"
        description="Sigue las conversaciones activas, revisa el contexto del turno y entra rapido en el intercambio adecuado."
      />

      {typedConvs.length === 0 ? (
        <EmptyState
          icon={<SearchX className="size-5" />}
          title="Todavia no tienes conversaciones"
          description="Cuando muestres interes en un turno o se abra una negociacion, la conversacion aparecera aqui con su contexto."
          action={
            <Link href="/shifts">
              <Button variant="outline">Explorar turnos</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {typedConvs.map((conversation) => {
            const other =
              conversation.participant_a.id === authUser.id
                ? conversation.participant_b
                : conversation.participant_a;

            const sortedMessages = [...conversation.messages].sort(
              (a, b) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
            );
            const lastMessage = sortedMessages[0];
            const unread = conversation.messages.filter(
              (message) => !message.read && message.sender_id !== authUser.id
            ).length;
            const initials = other.full_name
              .split(" ")
              .map((name) => name[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);
            const exchangeStatus = conversation.shift_id
              ? exchangesByShiftId.get(conversation.shift_id)
              : undefined;

            return (
              <Link
                key={conversation.id}
                href={`/chat/${conversation.id}`}
                className="block rounded-2xl border border-border/80 bg-card/96 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_18px_36px_-24px_rgba(15,23,42,0.18)] transition-[border-color,box-shadow,transform] hover:border-primary/20 hover:shadow-[0_1px_2px_rgba(15,23,42,0.05),0_24px_40px_-28px_rgba(37,99,235,0.25)]"
              >
                <div className="flex items-start gap-4">
                  <Avatar className="size-12 rounded-2xl">
                    <AvatarFallback className="rounded-2xl bg-secondary text-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold tracking-[-0.02em] text-foreground">
                          {other.full_name}
                        </p>
                        {conversation.shift && (
                          <p className="truncate text-sm text-muted-foreground">
                            {formatShortDate(conversation.shift.date)} ·{" "}
                            {SHIFT_TYPE_LABELS[
                              conversation.shift.shift_type as ShiftType
                            ]}{" "}
                            · {conversation.shift.department.name}
                          </p>
                        )}
                      </div>
                      {lastMessage && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatRelativeTime(lastMessage.created_at)}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-foreground">
                        Conversacion activa
                      </Badge>
                      {exchangeStatus && (
                        <Badge className={EXCHANGE_STATUS_STYLES[exchangeStatus]}>
                          {EXCHANGE_STATUS_LABELS[exchangeStatus]}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-sm leading-6 text-muted-foreground">
                        {lastMessage
                          ? lastMessage.content
                          : "Sin mensajes aun. Abre la conversacion para empezar."}
                      </p>
                      {unread > 0 && (
                        <Badge className="min-w-7 justify-center px-2 py-1 text-xs">
                          {unread}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
