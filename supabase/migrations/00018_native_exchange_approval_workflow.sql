-- Migration: native exchange approval workflow, in-app signatures, and traceability

ALTER TABLE public.exchanges
  ADD COLUMN IF NOT EXISTS submitted_for_approval_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_by_user_a_name TEXT,
  ADD COLUMN IF NOT EXISTS signed_by_user_b_name TEXT,
  ADD COLUMN IF NOT EXISTS department_approver_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS department_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS department_decision_notes TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

UPDATE public.exchanges
SET
  status = 'pending_department_approval',
  submitted_for_approval_at = COALESCE(
    submitted_for_approval_at,
    signed_by_user_a_at,
    signed_by_user_b_at,
    confirmed_at,
    created_at
  )
WHERE status = 'signed';

ALTER TABLE public.exchanges
  DROP CONSTRAINT IF EXISTS exchanges_status_check;

ALTER TABLE public.exchanges
  ADD CONSTRAINT exchanges_status_check
  CHECK (
    status IN (
      'pending_confirmation',
      'confirmed',
      'pending_department_approval',
      'approved',
      'rejected',
      'completed',
      'cancelled'
    )
  );

CREATE INDEX IF NOT EXISTS idx_exchanges_status
  ON public.exchanges(status);

CREATE INDEX IF NOT EXISTS idx_exchanges_pending_department_approval
  ON public.exchanges(status, submitted_for_approval_at DESC)
  WHERE status = 'pending_department_approval';

CREATE TABLE IF NOT EXISTS public.exchange_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exchange_id UUID NOT NULL REFERENCES public.exchanges(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  title TEXT NOT NULL,
  details TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT exchange_events_event_type_check
    CHECK (
      event_type IN (
        'exchange_created',
        'agreement_confirmed',
        'participant_signed',
        'submitted_for_approval',
        'department_approved',
        'department_rejected',
        'exchange_cancelled',
        'cancellation_requested',
        'cancellation_rejected',
        'support_document_attached'
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_exchange_events_exchange_id
  ON public.exchange_events(exchange_id, created_at DESC);

ALTER TABLE public.exchange_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (
    type IN (
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
      'exchange_pending_approval',
      'exchange_department_approved',
      'exchange_department_rejected',
      'account_approved',
      'account_rejected'
    )
  );
