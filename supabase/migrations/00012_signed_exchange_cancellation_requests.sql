-- Migration: reciprocal cancellation requests for signed exchanges

ALTER TABLE exchanges
  ADD COLUMN IF NOT EXISTS cancellation_requested_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ;
