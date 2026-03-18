import type { Notification } from "@/types";

export function getNotificationActionUrl(
  notification: Notification
): string | null {
  if (typeof notification.data?.action_url === "string") {
    return notification.data.action_url;
  }

  if (typeof notification.data?.exchange_id === "string") {
    return `/exchanges/${notification.data.exchange_id}`;
  }

  if (typeof notification.data?.conversation_id === "string") {
    return `/chat/${notification.data.conversation_id}`;
  }

  if (typeof notification.data?.shift_id === "string") {
    return `/shifts/${notification.data.shift_id}`;
  }

  return null;
}
