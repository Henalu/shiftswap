"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
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

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setContent("");

    const optimisticMessage: Message = {
      id: `temp_${Date.now()}`,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: trimmed,
      read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);

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
    <div className="overflow-hidden rounded-[1.75rem] border border-border/80 bg-card/96 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_20px_40px_-28px_rgba(15,23,42,0.18)]">
      <div className="border-b border-border/70 px-5 py-4">
        <p className="text-sm font-semibold text-foreground">{otherUserName}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Conversacion activa sobre un posible intercambio.
        </p>
      </div>

      <div
        ref={messagesContainerRef}
        onScroll={handleMessagesScroll}
        className="flex h-[min(60vh,42rem)] flex-1 flex-col gap-3 overflow-y-auto bg-[linear-gradient(180deg,transparent,rgba(248,250,252,0.65))] px-4 py-5 sm:px-5"
      >
        {messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-6 py-10 text-center">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">
                No hay mensajes aun
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                Usa este chat para aclarar detalles del turno y avanzar con el
                intercambio.
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const isMine = message.sender_id === currentUserId;
            return (
              <div
                key={message.id}
                className={cn("flex", isMine ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-[1.4rem] px-4 py-3 text-sm shadow-sm sm:max-w-[70%]",
                    isMine
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md border border-border/70 bg-background text-foreground"
                  )}
                >
                  <p className="leading-6">{message.content}</p>
                  <p
                    className={cn(
                      "mt-2 text-xs",
                      isMine
                        ? "text-right text-primary-foreground/75"
                        : "text-muted-foreground"
                    )}
                  >
                    {formatTime(message.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border/70 bg-background/95 p-4">
        <form onSubmit={handleSend} className="flex items-end gap-3">
          <div className="flex-1">
            <Input
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Escribe un mensaje claro y breve..."
              disabled={sending}
              className="h-12"
              autoComplete="off"
            />
          </div>
          <Button
            type="submit"
            size="icon"
            disabled={!content.trim() || sending}
            aria-label="Enviar mensaje"
          >
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
