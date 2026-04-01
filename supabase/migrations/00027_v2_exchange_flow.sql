-- Migration 00027: v2 Exchange Flow Redesign
--
-- Major simplification of the exchange flow:
--   - Eliminate "me interesa" toggle; replace with direct proposals
--   - Proposals carry agreement_type + compensation details upfront
--   - Publisher acceptance = implicit signature
--   - Only the interested party signs explicitly
--   - Renamed states: negotiating (shift), accepted/pending_validation (exchange)
--
-- Clean migration: all existing exchanges/requests are test data.

-- ============================================================
-- 1. Clean existing test data
-- ============================================================
DELETE FROM exchange_events;
DELETE FROM shift_debt_transactions;
DELETE FROM exchanges;
DELETE FROM shift_requests;
UPDATE public.shifts SET status = 'cancelled', updated_at = NOW()
  WHERE status IN ('pending', 'confirmed');

-- ============================================================
-- 2. Shift status: open, negotiating, completed, cancelled, expired
-- ============================================================
ALTER TABLE public.shifts
  DROP CONSTRAINT IF EXISTS shifts_status_check;

ALTER TABLE public.shifts
  ADD CONSTRAINT shifts_status_check
  CHECK (status IN ('open', 'negotiating', 'completed', 'cancelled', 'expired'));

-- ============================================================
-- 3. Add accepted_modalities to shifts
--    Controls which proposal types the publisher will accept.
-- ============================================================
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS accepted_modalities TEXT[]
  NOT NULL DEFAULT '{hours_bank,shift_exchange}';

-- ============================================================
-- 4. Exchange status: accepted, pending_validation, approved,
--    rejected, completed, cancelled, expired
-- ============================================================
ALTER TABLE public.exchanges
  DROP CONSTRAINT IF EXISTS exchanges_status_check;

ALTER TABLE public.exchanges
  ADD CONSTRAINT exchanges_status_check
  CHECK (status IN (
    'accepted', 'pending_validation', 'approved', 'rejected',
    'completed', 'cancelled', 'expired'
  ));

-- ============================================================
-- 5. Add proposal columns to shift_requests
--    Each proposal now carries the agreement terms upfront.
-- ============================================================
ALTER TABLE public.shift_requests
  ADD COLUMN IF NOT EXISTS agreement_type TEXT;

ALTER TABLE public.shift_requests
  ADD COLUMN IF NOT EXISTS compensation_shift_date DATE;

ALTER TABLE public.shift_requests
  ADD COLUMN IF NOT EXISTS compensation_shift_type TEXT;

-- Agreement type must be valid when present
ALTER TABLE public.shift_requests
  DROP CONSTRAINT IF EXISTS shift_requests_agreement_type_check;

ALTER TABLE public.shift_requests
  ADD CONSTRAINT shift_requests_agreement_type_check
  CHECK (agreement_type IS NULL OR agreement_type IN ('hours_bank', 'shift_exchange'));

-- Compensation fields consistency: shift_exchange requires date+type, hours_bank forbids them
ALTER TABLE public.shift_requests
  DROP CONSTRAINT IF EXISTS shift_requests_compensation_check;

ALTER TABLE public.shift_requests
  ADD CONSTRAINT shift_requests_compensation_check
  CHECK (
    (agreement_type = 'shift_exchange' AND compensation_shift_date IS NOT NULL AND compensation_shift_type IS NOT NULL)
    OR (agreement_type = 'hours_bank' AND compensation_shift_date IS NULL AND compensation_shift_type IS NULL)
    OR (agreement_type IS NULL)
  );

-- ============================================================
-- 6. Update exchange_events: relax event_type constraint
--    (handled by TypeScript types, not DB constraint)
-- ============================================================
ALTER TABLE public.exchange_events
  DROP CONSTRAINT IF EXISTS exchange_events_event_type_check;
