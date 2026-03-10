-- Migration: Fix missing RLS policies for chat and notification type constraint

-- ============================================
-- Conversations: INSERT and UPDATE policies
-- ============================================

-- Participants can create conversations
CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (participant_a_id = auth.uid() OR participant_b_id = auth.uid());

-- Participants can update conversations (e.g. updated_at on new message)
CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE
  USING (participant_a_id = auth.uid() OR participant_b_id = auth.uid());

-- ============================================
-- Messages: UPDATE policy (mark as read)
-- ============================================

-- Recipient can mark messages as read
CREATE POLICY "Users can mark messages as read"
  ON messages FOR UPDATE
  USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE participant_a_id = auth.uid() OR participant_b_id = auth.uid()
    )
    AND sender_id != auth.uid()
  );

-- ============================================
-- Notifications: add request_rejected type
-- ============================================

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'shift_request',
    'request_accepted',
    'request_rejected',
    'new_message',
    'exchange_confirmed'
  ));
