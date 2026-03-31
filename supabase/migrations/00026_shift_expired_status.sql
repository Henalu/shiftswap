-- Migration: Add expired status for shifts past their date
--
-- Shifts that have passed their date without completing an exchange
-- should stop appearing in active listings and be marked as expired.

-- 1. Expand the shifts status CHECK to include 'expired'
ALTER TABLE public.shifts
  DROP CONSTRAINT IF EXISTS shifts_status_check;

ALTER TABLE public.shifts
  ADD CONSTRAINT shifts_status_check
  CHECK (status IN ('open', 'pending', 'confirmed', 'completed', 'cancelled', 'expired'));

-- 2. Function to expire stale shifts (callable via cron or on-demand)
CREATE OR REPLACE FUNCTION public.expire_stale_shifts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE public.shifts
  SET status = 'expired', updated_at = NOW()
  WHERE date < CURRENT_DATE
    AND status IN ('open', 'pending');

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_shifts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_shifts() TO authenticated;

-- 3. Expire any already-past shifts right now
SELECT public.expire_stale_shifts();
