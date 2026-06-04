-- Keep stale shift publications out of negotiation once their date has passed.

CREATE OR REPLACE FUNCTION public.expire_stale_shifts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  affected INTEGER;
  stale_shift_ids UUID[];
  madrid_today DATE := (NOW() AT TIME ZONE 'Europe/Madrid')::DATE;
BEGIN
  SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::UUID[])
  INTO stale_shift_ids
  FROM public.shifts
  WHERE date < madrid_today
    AND status = 'open';

  IF COALESCE(CARDINALITY(stale_shift_ids), 0) = 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.shifts
  SET status = 'expired',
      updated_at = NOW()
  WHERE id = ANY(stale_shift_ids)
    AND status = 'open';

  GET DIAGNOSTICS affected = ROW_COUNT;

  UPDATE public.shift_requests
  SET status = 'rejected'
  WHERE shift_id = ANY(stale_shift_ids)
    AND status = 'pending';

  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_shifts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_shifts() TO authenticated;

SELECT public.expire_stale_shifts();
