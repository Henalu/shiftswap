import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
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

  // Fetch conversation and participants
  const { data: conv } = await supabase
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

  if (!conv) notFound();

  type Participant = { id: string; full_name: string };
  const typedConv = conv as unknown as {
    id: string;
    shift_id: string;
    participant_a: Participant;
    participant_b: Participant;
  };

  const otherUser =
    typedConv.participant_a.id === authUser.id
      ? typedConv.participant_b
      : typedConv.participant_a;

  // Fetch messages in order
  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  // Mark incoming messages as read
  await supabase
    .from("messages")
    .update({ read: true })
    .eq("conversation_id", id)
    .neq("sender_id", authUser.id)
    .eq("read", false);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/chat">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">
          {otherUser.full_name}
        </h1>
      </div>

      <ChatView
        conversationId={id}
        currentUserId={authUser.id}
        otherUserName={otherUser.full_name}
        initialMessages={(messages ?? []) as Message[]}
      />
    </div>
  );
}
