import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationData, NotificationType } from "@/types";

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
  data?: NotificationData;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type,
    title,
    body,
    data,
    read: false,
  });

  if (error) {
    console.error("Failed to create notification", error.message, {
      userId,
      type,
    });
  }
}
