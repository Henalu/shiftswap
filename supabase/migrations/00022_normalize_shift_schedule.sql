-- ShiftSwap - Normalize fixed shift schedules from shift_type

CREATE OR REPLACE FUNCTION public.apply_shift_schedule()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  CASE NEW.shift_type
    WHEN 'morning' THEN
      NEW.start_time = TIME '06:00';
      NEW.end_time = TIME '14:00';
    WHEN 'afternoon' THEN
      NEW.start_time = TIME '14:00';
      NEW.end_time = TIME '22:00';
    WHEN 'night' THEN
      NEW.start_time = TIME '22:00';
      NEW.end_time = TIME '06:00';
    ELSE
      RAISE EXCEPTION 'Invalid shift_type: %', NEW.shift_type
        USING ERRCODE = '23514';
  END CASE;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_shift_schedule_from_type ON public.shifts;

CREATE TRIGGER set_shift_schedule_from_type
BEFORE INSERT OR UPDATE OF shift_type, start_time, end_time
ON public.shifts
FOR EACH ROW
EXECUTE FUNCTION public.apply_shift_schedule();
