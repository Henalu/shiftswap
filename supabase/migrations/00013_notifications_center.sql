-- Migration: enable realtime notifications and create chat notification events

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
  END IF;
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

  INSERT INTO notifications (user_id, type, title, body, read, data)
  VALUES (
    recipient_id,
    'new_message',
    'Nuevo mensaje de ' || COALESCE(sender_name, 'otro empleado'),
    preview,
    false,
    jsonb_build_object(
      'conversation_id', NEW.conversation_id,
      'shift_id', shift_id_value,
      'action_url', '/chat/' || NEW.conversation_id
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_on_new_message ON messages;

CREATE TRIGGER notify_on_new_message
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION public.create_message_notification();
