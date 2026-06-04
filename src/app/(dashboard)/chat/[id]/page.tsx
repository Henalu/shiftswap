import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateISO } from "@/lib/calendar";
import { getUserCalendar } from "@/lib/calendar-data";
import { getMadridDateInputValue } from "@/lib/exchange-compensation";
import { createClient } from "@/lib/supabase/server";
import { ChatView } from "./chat-view";
import {
  DirectProposalsPanel,
  type DirectChatProposal,
} from "./direct-proposals-panel";
import type { Message } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ConversationPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/login");

  const { data: conversation } = await supabase
    .from("conversations")
    .select(
      `
      id, shift_id,
      participant_a:user_profiles!participant_a_id(id, full_name),
      participant_b:user_profiles!participant_b_id(id, full_name)
    `
    )
    .eq("id", id)
    .or(
      `participant_a_id.eq.${authUser.id},participant_b_id.eq.${authUser.id}`
    )
    .single();

  if (!conversation) notFound();

  type Participant = { id: string; full_name: string | null };
  const typedConversation = conversation as unknown as {
    id: string;
    shift_id: string | null;
    participant_a: Participant;
    participant_b: Participant;
  };

  const otherUser =
    typedConversation.participant_a.id === authUser.id
      ? typedConversation.participant_b
      : typedConversation.participant_a;
  const otherUserName = otherUser.full_name ?? "Empleado";

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  const now = new Date().toISOString();

  await supabase
    .from("messages")
    .update({ read: true })
    .eq("conversation_id", id)
    .neq("sender_id", authUser.id)
    .eq("read", false);

  await supabase
    .from("notifications")
    .update({ read: true, read_at: now, resolved_at: now })
    .eq("user_id", authUser.id)
    .eq("type", "new_message")
    .eq("read", false)
    .contains("data", { conversation_id: id });

  await supabase
    .from("notifications")
    .update({ read: true, read_at: now })
    .eq("user_id", authUser.id)
    .in("type", ["proposal_received", "proposal_accepted", "proposal_rejected"])
    .eq("read", false)
    .contains("data", { conversation_id: id });

  const today = getMadridDateInputValue();
  const calendarEndSeed = new Date(
    Number(today.slice(0, 4)),
    Number(today.slice(5, 7)) - 1,
    Number(today.slice(8, 10)),
  );
  calendarEndSeed.setDate(calendarEndSeed.getDate() + 180);
  const calendarEnd = formatDateISO(calendarEndSeed);
  const calendarDays = await getUserCalendar(authUser.id, today, calendarEnd);

  const { data: directShifts } = await supabase
    .from("shifts")
    .select(
      "id, user_id, direct_recipient_id, date, start_time, end_time, shift_type, status, description, created_at",
    )
    .not("direct_recipient_id", "is", null)
    .or(`user_id.eq.${authUser.id},direct_recipient_id.eq.${authUser.id}`)
    .order("created_at", { ascending: false })
    .limit(12);

  const proposalShifts = ((directShifts ?? []) as unknown as Omit<
    DirectChatProposal,
    "request" | "exchangeId"
  >[])
    .filter(
      (shift) =>
        (shift.user_id === authUser.id &&
          shift.direct_recipient_id === otherUser.id) ||
        (shift.user_id === otherUser.id &&
          shift.direct_recipient_id === authUser.id),
    )
    .map((shift) => ({ ...shift, request: null, exchangeId: null }));

  const proposalShiftIds = proposalShifts.map((shift) => shift.id);
  const [{ data: directRequests }, { data: directExchanges }] =
    proposalShiftIds.length === 0
      ? [{ data: [] }, { data: [] }]
      : await Promise.all([
          supabase
            .from("shift_requests")
            .select(
              "id, shift_id, status, agreement_type, compensation_shift_date, compensation_shift_type",
            )
            .in("shift_id", proposalShiftIds)
            .order("created_at", { ascending: false }),
          supabase
            .from("exchanges")
            .select("id, shift_id, status, created_at")
            .in("shift_id", proposalShiftIds)
            .order("created_at", { ascending: false }),
        ]);

  const requestByShiftId = new Map(
    (directRequests ?? []).map((request) => [request.shift_id, request]),
  );
  const exchangeByShiftId = new Map(
    (directExchanges ?? []).map((exchange) => [exchange.shift_id, exchange.id]),
  );
  const directProposals: DirectChatProposal[] = proposalShifts.map((shift) => ({
    ...shift,
    request: requestByShiftId.get(shift.id) ?? null,
    exchangeId: exchangeByShiftId.get(shift.id) ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Conversacion"
        title={otherUserName}
        description="Negocia el intercambio con contexto y mantente dentro del flujo sin perder visibilidad del estado."
        action={
          <Link href="/chat">
            <Button variant="ghost">
              <ArrowLeft className="size-4" />
              Volver al chat
            </Button>
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)]">
        <div className="xl:order-2">
          <DirectProposalsPanel
            conversationId={id}
            currentUserId={authUser.id}
            otherUserId={otherUser.id}
            otherUserName={otherUserName}
            calendarDays={calendarDays}
            proposals={directProposals}
          />
        </div>
        <div className="xl:order-1">
          <ChatView
            conversationId={id}
            currentUserId={authUser.id}
            otherUserName={otherUserName}
            initialMessages={(messages ?? []) as Message[]}
          />
        </div>
      </div>
    </div>
  );
}
