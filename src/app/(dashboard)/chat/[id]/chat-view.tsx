"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/types";

interface ChatViewProps {
  conversationId: string;
  currentUserId: string;
  otherUserName: string;
  initialMessages: Message[];
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mergeIncomingMessage(
  currentMessages: Message[],
  incomingMessage: Message
): Message[] {
  const withoutOptimistic = currentMessages.filter(
    (message) =>
      !(
        message.id.startsWith("temp_") &&
        message.sender_id === incomingMessage.sender_id &&
        message.content === incomingMessage.content
      )
  );

  if (withoutOptimistic.some((message) => message.id === incomingMessage.id)) {
    return withoutOptimistic;
  }

  return [...withoutOptimistic, incomingMessage].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

export function ChatView({
  conversationId,
  currentUserId,
  otherUserName,
  initialMessages,
}: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const latestCreatedAtRef = useRef<string | null>(
    initialMessages[initialMessages.length - 1]?.created_at ?? null
  );

  // Realtime subscription — delivers new messages in real time.
  // NOTE: No server-side filter — messages table lacks REPLICA IDENTITY FULL,
  // so postgres_changes column filters are unreliable. We filter client-side.
  // RLS already ensures only messages from the user's own conversations arrive.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const incoming = payload.new as Message;
          // Client-side filter: ignore messages from other conversations
          if (incoming.conversation_id !== conversationId) return;

          setMessages((prev) => mergeIncomingMessage(prev, incoming));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    latestCreatedAtRef.current =
      messages[messages.length - 1]?.created_at ?? null;
  }, [messages]);

  // Fallback sync: if Realtime is not enabled for `messages` in the active
  // Supabase environment, poll the latest rows so the other participant still
  // sees new messages without refreshing the page.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function syncLatestMessages() {
      let query = supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      const latestCreatedAt = latestCreatedAtRef.current;
      if (latestCreatedAt) {
        query = query.gte("created_at", latestCreatedAt);
      }

      const { data, error } = await query;

      if (cancelled || error || !data || data.length === 0) return;

      setMessages((prev) =>
        data.reduce(
          (nextMessages, rawMessage) =>
            mergeIncomingMessage(nextMessages, rawMessage as Message),
          prev
        )
      );
    }

    const intervalId = window.setInterval(syncLatestMessages, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [conversationId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setContent("");

    // Optimistic update — message appears immediately
    const optimisticMsg: Message = {
      id: `temp_${Date.now()}`,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: trimmed,
      read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    const supabase = createClient();
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: trimmed,
      read: false,
    });

    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    setSending(false);
  }

  return (
    <div className="flex h-[calc(100dvh-12rem)] flex-col rounded-lg border md:h-[calc(100dvh-8rem)]">
      {/* Chat header */}
      <div className="border-b px-4 py-3">
        <p className="font-medium">{otherUserName}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay mensajes aún. ¡Inicia la conversación!
          </p>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === currentUserId;
            return (
              <div
                key={msg.id}
                className={cn("flex", isMine ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                    isMine
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  )}
                >
                  <p>{msg.content}</p>
                  <p
                    className={cn(
                      "mt-1 text-[10px]",
                      isMine
                        ? "text-right text-primary-foreground/70"
                        : "text-muted-foreground"
                    )}
                  >
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <form onSubmit={handleSend} className="flex gap-2">
          <Input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Escribe un mensaje..."
            disabled={sending}
            className="flex-1"
            autoComplete="off"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!content.trim() || sending}
          >
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
