-- Early adopter pricing and checkout plan assignment.

CREATE TABLE IF NOT EXISTS public.billing_pricing_cohorts (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  min_position INTEGER NOT NULL,
  max_position INTEGER,
  trial_days INTEGER NOT NULL DEFAULT 0,
  price_lock_months INTEGER NOT NULL DEFAULT 12,
  discount_label TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT billing_pricing_cohorts_position_check
    CHECK (min_position > 0 AND (max_position IS NULL OR max_position >= min_position)),
  CONSTRAINT billing_pricing_cohorts_trial_days_check
    CHECK (trial_days >= 0),
  CONSTRAINT billing_pricing_cohorts_lock_months_check
    CHECK (price_lock_months >= 0)
);

DROP TRIGGER IF EXISTS set_updated_at_billing_pricing_cohorts
  ON public.billing_pricing_cohorts;

CREATE TRIGGER set_updated_at_billing_pricing_cohorts
BEFORE UPDATE ON public.billing_pricing_cohorts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.billing_plans
  ADD COLUMN IF NOT EXISTS cohort_code TEXT,
  ADD COLUMN IF NOT EXISTS price_label TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_env_var TEXT,
  ADD COLUMN IF NOT EXISTS marketing_badge TEXT,
  ADD COLUMN IF NOT EXISTS trial_days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_lock_months INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 100;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'billing_plans_cohort_code_fkey'
      AND conrelid = 'public.billing_plans'::regclass
  ) THEN
    ALTER TABLE public.billing_plans
      ADD CONSTRAINT billing_plans_cohort_code_fkey
      FOREIGN KEY (cohort_code)
      REFERENCES public.billing_pricing_cohorts(code);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'billing_plans_trial_days_check'
      AND conrelid = 'public.billing_plans'::regclass
  ) THEN
    ALTER TABLE public.billing_plans
      ADD CONSTRAINT billing_plans_trial_days_check
      CHECK (trial_days >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'billing_plans_lock_months_check'
      AND conrelid = 'public.billing_plans'::regclass
  ) THEN
    ALTER TABLE public.billing_plans
      ADD CONSTRAINT billing_plans_lock_months_check
      CHECK (price_lock_months >= 0);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_billing_plans_public_cohort_interval
  ON public.billing_plans(owner_type, is_public, active, cohort_code, billing_interval, sort_order);

ALTER TABLE public.billing_accounts
  ADD COLUMN IF NOT EXISTS billing_plan_id UUID,
  ADD COLUMN IF NOT EXISTS pricing_cohort_code TEXT,
  ADD COLUMN IF NOT EXISTS billing_interval TEXT,
  ADD COLUMN IF NOT EXISTS early_access_position INTEGER,
  ADD COLUMN IF NOT EXISTS price_lock_ends_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'billing_accounts_billing_plan_id_fkey'
      AND conrelid = 'public.billing_accounts'::regclass
  ) THEN
    ALTER TABLE public.billing_accounts
      ADD CONSTRAINT billing_accounts_billing_plan_id_fkey
      FOREIGN KEY (billing_plan_id)
      REFERENCES public.billing_plans(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'billing_accounts_pricing_cohort_code_fkey'
      AND conrelid = 'public.billing_accounts'::regclass
  ) THEN
    ALTER TABLE public.billing_accounts
      ADD CONSTRAINT billing_accounts_pricing_cohort_code_fkey
      FOREIGN KEY (pricing_cohort_code)
      REFERENCES public.billing_pricing_cohorts(code);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'billing_accounts_interval_check'
      AND conrelid = 'public.billing_accounts'::regclass
  ) THEN
    ALTER TABLE public.billing_accounts
      ADD CONSTRAINT billing_accounts_interval_check
      CHECK (billing_interval IS NULL OR billing_interval IN ('month', 'year'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'billing_accounts_early_position_check'
      AND conrelid = 'public.billing_accounts'::regclass
  ) THEN
    ALTER TABLE public.billing_accounts
      ADD CONSTRAINT billing_accounts_early_position_check
      CHECK (early_access_position IS NULL OR early_access_position > 0);
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_accounts_early_access_position
  ON public.billing_accounts(early_access_position)
  WHERE early_access_position IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_accounts_pricing_state
  ON public.billing_accounts(pricing_cohort_code, billing_interval, current_billing_state);

INSERT INTO public.billing_pricing_cohorts (
  code,
  label,
  description,
  min_position,
  max_position,
  trial_days,
  price_lock_months,
  discount_label,
  active
)
VALUES
  (
    'founder_20',
    'Fundadores 1-20',
    'Primeras 20 cuentas: primer mes gratis y mayor descuento early adopter.',
    1,
    20,
    30,
    12,
    'Primer mes gratis + mayor descuento',
    TRUE
  ),
  (
    'early_70',
    'Early adopters 21-70',
    'Siguientes 50 cuentas con descuento alto durante el primer ano.',
    21,
    70,
    0,
    12,
    'Descuento alto',
    TRUE
  ),
  (
    'growth_170',
    'Crecimiento 71-170',
    'Siguientes 100 cuentas con descuento medio durante el primer ano.',
    71,
    170,
    0,
    12,
    'Descuento medio',
    TRUE
  ),
  (
    'launch_200',
    'Lanzamiento 171-200',
    'Ultimas 30 plazas promocionales antes del precio estandar.',
    171,
    200,
    0,
    12,
    'Descuento de lanzamiento',
    TRUE
  ),
  (
    'standard',
    'Precio estandar',
    'Precio normal para nuevas cuentas una vez cerrado el programa early adopter.',
    201,
    NULL,
    0,
    0,
    'Sin descuento promocional',
    TRUE
  )
ON CONFLICT (code) DO UPDATE
SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  min_position = EXCLUDED.min_position,
  max_position = EXCLUDED.max_position,
  trial_days = EXCLUDED.trial_days,
  price_lock_months = EXCLUDED.price_lock_months,
  discount_label = EXCLUDED.discount_label,
  active = EXCLUDED.active;

UPDATE public.billing_plans
SET is_public = FALSE
WHERE code IN ('user_monthly_v1', 'company_monthly_v1');

INSERT INTO public.billing_plans (
  code,
  owner_type,
  name,
  description,
  billing_interval,
  currency,
  amount_cents,
  active,
  cohort_code,
  price_label,
  stripe_price_env_var,
  marketing_badge,
  trial_days,
  price_lock_months,
  is_public,
  sort_order
)
VALUES
  ('founder_20_monthly', 'user', 'Fundadores mensual', 'Plan mensual para las primeras 20 cuentas.', 'month', 'eur', 0, TRUE, 'founder_20', 'Precio fundador mensual', 'STRIPE_PRICE_FOUNDER_20_MONTHLY', '1 mes gratis', 30, 12, TRUE, 10),
  ('founder_20_annual', 'user', 'Fundadores anual', 'Plan anual para las primeras 20 cuentas con descuento adicional.', 'year', 'eur', 0, TRUE, 'founder_20', 'Precio fundador anual', 'STRIPE_PRICE_FOUNDER_20_ANNUAL', 'Anual con descuento', 30, 12, TRUE, 11),
  ('early_70_monthly', 'user', 'Early adopter mensual', 'Plan mensual para cuentas 21 a 70.', 'month', 'eur', 0, TRUE, 'early_70', 'Precio early adopter mensual', 'STRIPE_PRICE_EARLY_70_MONTHLY', 'Descuento alto', 0, 12, TRUE, 20),
  ('early_70_annual', 'user', 'Early adopter anual', 'Plan anual para cuentas 21 a 70 con descuento adicional.', 'year', 'eur', 0, TRUE, 'early_70', 'Precio early adopter anual', 'STRIPE_PRICE_EARLY_70_ANNUAL', 'Anual con descuento', 0, 12, TRUE, 21),
  ('growth_170_monthly', 'user', 'Crecimiento mensual', 'Plan mensual para cuentas 71 a 170.', 'month', 'eur', 0, TRUE, 'growth_170', 'Precio crecimiento mensual', 'STRIPE_PRICE_GROWTH_170_MONTHLY', 'Descuento medio', 0, 12, TRUE, 30),
  ('growth_170_annual', 'user', 'Crecimiento anual', 'Plan anual para cuentas 71 a 170 con descuento adicional.', 'year', 'eur', 0, TRUE, 'growth_170', 'Precio crecimiento anual', 'STRIPE_PRICE_GROWTH_170_ANNUAL', 'Anual con descuento', 0, 12, TRUE, 31),
  ('launch_200_monthly', 'user', 'Lanzamiento mensual', 'Plan mensual para cuentas 171 a 200.', 'month', 'eur', 0, TRUE, 'launch_200', 'Precio lanzamiento mensual', 'STRIPE_PRICE_LAUNCH_200_MONTHLY', 'Descuento final', 0, 12, TRUE, 40),
  ('launch_200_annual', 'user', 'Lanzamiento anual', 'Plan anual para cuentas 171 a 200 con descuento adicional.', 'year', 'eur', 0, TRUE, 'launch_200', 'Precio lanzamiento anual', 'STRIPE_PRICE_LAUNCH_200_ANNUAL', 'Anual con descuento', 0, 12, TRUE, 41),
  ('standard_monthly', 'user', 'Estandar mensual', 'Plan mensual estandar tras el programa early adopter.', 'month', 'eur', 0, TRUE, 'standard', 'Precio estandar mensual', 'STRIPE_PRICE_STANDARD_MONTHLY', 'Precio estandar', 0, 0, TRUE, 50),
  ('standard_annual', 'user', 'Estandar anual', 'Plan anual estandar con descuento frente al mensual.', 'year', 'eur', 0, TRUE, 'standard', 'Precio estandar anual', 'STRIPE_PRICE_STANDARD_ANNUAL', 'Anual con descuento', 0, 0, TRUE, 51)
ON CONFLICT (code) DO UPDATE
SET
  owner_type = EXCLUDED.owner_type,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  billing_interval = EXCLUDED.billing_interval,
  currency = EXCLUDED.currency,
  active = EXCLUDED.active,
  cohort_code = EXCLUDED.cohort_code,
  price_label = EXCLUDED.price_label,
  stripe_price_env_var = EXCLUDED.stripe_price_env_var,
  marketing_badge = EXCLUDED.marketing_badge,
  trial_days = EXCLUDED.trial_days,
  price_lock_months = EXCLUDED.price_lock_months,
  is_public = EXCLUDED.is_public,
  sort_order = EXCLUDED.sort_order;

CREATE OR REPLACE FUNCTION public.assign_billing_plan_for_checkout(
  target_billing_account_id UUID,
  requested_interval TEXT
)
RETURNS TABLE (
  billing_account_id UUID,
  billing_plan_id UUID,
  plan_code TEXT,
  stripe_price_id TEXT,
  stripe_price_env_var TEXT,
  pricing_cohort_code TEXT,
  early_access_position INTEGER,
  trial_days INTEGER,
  price_lock_ends_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  account_row public.billing_accounts%ROWTYPE;
  cohort_row public.billing_pricing_cohorts%ROWTYPE;
  plan_row public.billing_plans%ROWTYPE;
  next_position INTEGER;
  normalized_interval TEXT := LOWER(BTRIM(requested_interval));
BEGIN
  IF normalized_interval NOT IN ('month', 'year') THEN
    RAISE EXCEPTION 'Billing interval must be month or year';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('shiftswap_billing_pricing_assignment'));

  SELECT *
  INTO account_row
  FROM public.billing_accounts
  WHERE id = target_billing_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Billing account not found';
  END IF;

  IF account_row.owner_type <> 'user' THEN
    RAISE EXCEPTION 'Early adopter checkout is only available for user billing accounts';
  END IF;

  next_position := account_row.early_access_position;

  IF next_position IS NULL THEN
    SELECT COALESCE(MAX(public.billing_accounts.early_access_position), 0) + 1
    INTO next_position
    FROM public.billing_accounts
    WHERE owner_type = 'user';
  END IF;

  SELECT *
  INTO cohort_row
  FROM public.billing_pricing_cohorts
  WHERE active = TRUE
    AND min_position <= next_position
    AND (max_position IS NULL OR max_position >= next_position)
  ORDER BY min_position DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active pricing cohort found for position %', next_position;
  END IF;

  SELECT *
  INTO plan_row
  FROM public.billing_plans
  WHERE owner_type = 'user'
    AND active = TRUE
    AND is_public = TRUE
    AND cohort_code = cohort_row.code
    AND billing_interval = normalized_interval
  ORDER BY sort_order ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active billing plan found for cohort % and interval %', cohort_row.code, normalized_interval;
  END IF;

  UPDATE public.billing_accounts
  SET
    billing_plan_id = plan_row.id,
    pricing_cohort_code = cohort_row.code,
    billing_interval = normalized_interval,
    early_access_position = next_position,
    price_lock_ends_at = CASE
      WHEN plan_row.price_lock_months > 0 AND account_row.price_lock_ends_at IS NULL
        THEN NOW() + make_interval(months => plan_row.price_lock_months)
      ELSE account_row.price_lock_ends_at
    END
  WHERE id = target_billing_account_id
  RETURNING *
  INTO account_row;

  RETURN QUERY
  SELECT
    account_row.id,
    plan_row.id,
    plan_row.code,
    plan_row.stripe_price_id,
    plan_row.stripe_price_env_var,
    cohort_row.code,
    account_row.early_access_position,
    plan_row.trial_days,
    account_row.price_lock_ends_at;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_billing_plan_for_checkout(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_billing_plan_for_checkout(UUID, TEXT)
  TO service_role;

ALTER TABLE public.billing_pricing_cohorts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.billing_pricing_cohorts FROM anon, authenticated;
GRANT ALL ON TABLE public.billing_pricing_cohorts TO service_role;
