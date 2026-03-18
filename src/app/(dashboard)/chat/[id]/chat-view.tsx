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

const BOTTOM_SCROLL_THRESHOLD = 80;

function isNearBottom(container: HTMLDivElement) {
  const distanceFromBottom =
    container.scrollHeight - container.scrollTop - container.clientHeight;

  return distanceFromBottom <= BOTTOM_SCROLL_THRESHOLD;
}

function mergeIncomingMessage(
  currentMessages: Message[],
  incomingMessage: Message
): Message[] {
  const optimisticIndex = currentMessages.findIndex(
    (message) =>
      message.id.startsWith("temp_") &&
      message.sender_id === incomingMessage.sender_id &&
      message.content === incomingMessage.content
  );

  const withoutOptimistic =
    optimisticIndex === -1
      ? currentMessages
      : currentMessages.filter((_, index) => index !== optimisticIndex);

  if (withoutOptimistic.some((message) => message.id === incomingMessage.id)) {
    return withoutOptimistic;
  }

  return [...withoutOptimistic, incomingMessage].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

async function markConversationAsRead(
  conversationId: string,
  currentUserId: string
) {
  const supabase = createClient();
  const now = new Date().toISOString();

  await supabase
    .from("messages")
    .update({ read: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", currentUserId)
    .eq("read", false);

  await supabase
    .from("notifications")
    .update({ read: true, read_at: now, resolved_at: now })
    .eq("user_id", currentUserId)
    .eq("type", "new_message")
    .eq("read", false)
    .contains("data", { conversation_id: conversationId });
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
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasInitialScrollRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const latestCreatedAtRef = useRef<string | null>(
    initialMessages[initialMessages.length - 1]?.created_at ?? null
  );
  const previousLastMessageIdRef = useRef<string | null>(
    initialMessages[initialMessages.length - 1]?.id ?? null
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

          if (incoming.sender_id !== currentUserId) {
            void markConversationAsRead(conversationId, currentUserId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId]);

  useEffect(() => {
    latestCreatedAtRef.current =
      messages[messages.length - 1]?.created_at ?? null;
  }, [messages]);

  useEffect(() => {
    void markConversationAsRead(conversationId, currentUserId);
  }, [conversationId, currentUserId]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    isNearBottomRef.current = isNearBottom(container);
  }, []);

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

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    const isInitialLoad = !hasInitialScrollRef.current;
    const hasNewLastMessage = lastMessage.id !== previousLastMessageIdRef.current;
    const shouldScroll =
      isInitialLoad ||
      (hasNewLastMessage &&
        (isNearBottomRef.current || lastMessage.sender_id === currentUserId));

    if (shouldScroll) {
      bottomRef.current?.scrollIntoView({
        behavior: isInitialLoad ? "auto" : "smooth",
        block: "end",
      });
      isNearBottomRef.current = true;
    }

    if (isInitialLoad) {
      hasInitialScrollRef.current = true;
    }

    previousLastMessageIdRef.current = lastMessage.id;
  }, [currentUserId, messages]);

  function handleMessagesScroll() {
    const container = messagesContainerRef.current;
    if (!container) return;

    isNearBottomRef.current = isNearBottom(container);
  }

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
      <div
        ref={messagesContainerRef}
        onScroll={handleMessagesScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
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
