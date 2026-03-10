import { createClient } from "@/lib/supabase/server";
import type { Notification } from "@/types";

type NotificationType = Notification["type"];

export async function createNotification({
  userId,
  type,
  title,
  body,
  data,
}: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  const supabase = await createClient();
  await supabase.from("notifications").insert({
    user_id: userId,
    type,
    title,
    body,
    data,
    read: false,
  });
}
