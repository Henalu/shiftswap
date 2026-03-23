import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { ChatView } from "./chat-view";
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

  type Participant = { id: string; full_name: string };
  const typedConversation = conversation as unknown as {
    id: string;
    shift_id: string;
    participant_a: Participant;
    participant_b: Participant;
  };

  const otherUser =
    typedConversation.participant_a.id === authUser.id
      ? typedConversation.participant_b
      : typedConversation.participant_a;

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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Conversacion"
        title={otherUser.full_name}
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

      <ChatView
        conversationId={id}
        currentUserId={authUser.id}
        otherUserName={otherUser.full_name}
        initialMessages={(messages ?? []) as Message[]}
      />
    </div>
  );
}
