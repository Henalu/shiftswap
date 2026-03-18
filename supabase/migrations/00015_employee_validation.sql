-- Migration: employee validation workflow, admin gate, and private ID card storage

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS employee_id TEXT,
  ADD COLUMN IF NOT EXISTS id_card_url TEXT,
  ADD COLUMN IF NOT EXISTS validation_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS validation_notes TEXT,
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_validation_status_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_validation_status_check
  CHECK (validation_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_user_profiles_validation_status
  ON public.user_profiles(validation_status);

CREATE INDEX IF NOT EXISTS idx_user_profiles_is_admin
  ON public.user_profiles(is_admin)
  WHERE is_admin = TRUE;

-- Keep current users active after introducing manual validation.
-- New registrations will provide employee_id + id_card_url and remain pending.
UPDATE public.user_profiles
SET
  validation_status = 'approved',
  validated_at = COALESCE(validated_at, created_at)
WHERE validation_status = 'pending'
  AND employee_id IS NULL
  AND id_card_url IS NULL
  AND validated_by IS NULL
  AND validated_at IS NULL
  AND validation_notes IS NULL;

-- Preserve admin capabilities for any existing role-based admins.
UPDATE public.user_profiles
SET is_admin = TRUE
WHERE role = 'admin';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'id-cards',
  'id-cards',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
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
    'exchange_cancellation_rejected',
    'account_approved',
    'account_rejected'
  ));

REVOKE SELECT, INSERT, UPDATE ON public.user_profiles FROM anon, authenticated;

GRANT SELECT (
  id,
  email,
  full_name,
  company_id,
  department_id,
  role,
  avatar_url,
  phone,
  created_at,
  updated_at
) ON public.user_profiles TO authenticated;

GRANT INSERT (
  id,
  email,
  full_name,
  company_id,
  department_id,
  role,
  avatar_url,
  phone
) ON public.user_profiles TO authenticated;

GRANT UPDATE (
  full_name,
  department_id,
  avatar_url,
  phone
) ON public.user_profiles TO authenticated;
