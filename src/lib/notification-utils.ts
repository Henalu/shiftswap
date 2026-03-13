import type { Notification } from "@/types";

export function getNotificationActionUrl(
  notification: Notification
): string | null {
  if (typeof notification.data?.action_url === "string") {
    return notification.data.action_url;
  }

  if (
    notification.type === "new_message" &&
    typeof notification.data?.conversation_id === "string"
  ) {
    return `/chat/${notification.data.conversation_id}`;
  }

  if (
    (notification.type === "request_accepted" ||
      notification.type === "exchange_confirmed") &&
    typeof notification.data?.exchange_id === "string"
  ) {
    return `/exchanges/${notification.data.exchange_id}`;
  }

  if (typeof notification.data?.shift_id === "string") {
    return `/shifts/${notification.data.shift_id}`;
  }

  return null;
}
