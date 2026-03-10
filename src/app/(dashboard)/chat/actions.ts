"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function startConversation(formData: FormData): Promise<void> {
  const shiftId = formData.get("shift_id") as string;
  const otherUserId = formData.get("other_user_id") as string;

  if (!shiftId || !otherUserId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Check if conversation already exists (either direction)
  const { data: existing1 } = await supabase
    .from("conversations")
    .select("id")
    .eq("shift_id", shiftId)
    .eq("participant_a_id", user.id)
    .eq("participant_b_id", otherUserId)
    .maybeSingle();

  if (existing1) redirect(`/chat/${existing1.id}`);

  const { data: existing2 } = await supabase
    .from("conversations")
    .select("id")
    .eq("shift_id", shiftId)
    .eq("participant_a_id", otherUserId)
    .eq("participant_b_id", user.id)
    .maybeSingle();

  if (existing2) redirect(`/chat/${existing2.id}`);

  // Create new conversation
  const { data: newConv } = await supabase
    .from("conversations")
    .insert({
      shift_id: shiftId,
      participant_a_id: user.id,
      participant_b_id: otherUserId,
    })
    .select("id")
    .single();

  if (newConv) redirect(`/chat/${newConv.id}`);
}
