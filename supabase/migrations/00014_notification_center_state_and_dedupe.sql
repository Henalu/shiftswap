-- Migration: expand notification center state, dedupe, and event types

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE notifications
SET
  read_at = COALESCE(read_at, created_at),
  updated_at = COALESCE(updated_at, created_at)
WHERE read = TRUE;

UPDATE notifications
SET updated_at = created_at
WHERE updated_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notifications_user_dedupe_key_key'
  ) THEN
    ALTER TABLE notifications
      ADD CONSTRAINT notifications_user_dedupe_key_key
      UNIQUE (user_id, dedupe_key);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_notifications_user_inbox
  ON notifications(user_id, resolved_at, read, updated_at DESC);

DROP TRIGGER IF EXISTS set_notifications_updated_at ON notifications;

CREATE TRIGGER set_notifications_updated_at
BEFORE UPDATE ON notifications
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'shift_request',
    'request_accepted',
    'request_rejected',
    'shift_cancelled',
    'new_message',
    'exchange_confirmed',
    'exchange_signed',
    'exchange_document_added',
    'exchange_cancelled',
    'exchange_cancellation_requested',
    'exchange_cancellation_rejected'
  ));

CREATE OR REPLACE FUNCTION public.upsert_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'::jsonb,
  p_dedupe_key TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (
    user_id,
    type,
    title,
    body,
    read,
    read_at,
    resolved_at,
    data,
    dedupe_key
  )
  VALUES (
    p_user_id,
    p_type,
    p_title,
    p_body,
    FALSE,
    NULL,
    NULL,
    COALESCE(p_data, '{}'::jsonb),
    p_dedupe_key
  )
  ON CONFLICT (user_id, dedupe_key)
  DO UPDATE SET
    type = EXCLUDED.type,
    title = EXCLUDED.title,
    body = EXCLUDED.body,
    data = EXCLUDED.data,
    read = FALSE,
    read_at = NULL,
    resolved_at = NULL,
    updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.create_message_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id UUID;
  shift_id_value UUID;
  sender_name TEXT;
  preview TEXT;
BEGIN
  SELECT
    CASE
      WHEN participant_a_id = NEW.sender_id THEN participant_b_id
      ELSE participant_a_id
    END,
    shift_id
  INTO recipient_id, shift_id_value
  FROM conversations
  WHERE id = NEW.conversation_id;

  IF recipient_id IS NULL OR recipient_id = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  SELECT full_name
  INTO sender_name
  FROM user_profiles
  WHERE id = NEW.sender_id;

  preview := CASE
    WHEN char_length(NEW.content) > 120 THEN left(NEW.content, 117) || '...'
    ELSE NEW.content
  END;

  PERFORM public.upsert_notification(
    recipient_id,
    'new_message',
    'Nuevo mensaje de ' || COALESCE(sender_name, 'otro empleado'),
    preview,
    jsonb_build_object(
      'conversation_id', NEW.conversation_id,
      'shift_id', shift_id_value,
      'action_url', '/chat/' || NEW.conversation_id
    ),
    'new_message:' || NEW.conversation_id::text
  );

  RETURN NEW;
END;
$$;
