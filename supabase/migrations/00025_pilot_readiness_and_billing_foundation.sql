-- Pilot readiness + billing foundation
-- Goal: add server-enforced auth rate limiting and a billing domain that supports
-- both user-paid and company-paid subscriptions without parallel schemas.

CREATE TABLE IF NOT EXISTS public.request_rate_limits (
  scope TEXT NOT NULL,
  bucket_key TEXT NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_hit_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope, bucket_key),
  CONSTRAINT request_rate_limits_hits_non_negative
    CHECK (hits >= 0)
);

DROP TRIGGER IF EXISTS set_updated_at_request_rate_limits
  ON public.request_rate_limits;

CREATE TRIGGER set_updated_at_request_rate_limits
BEFORE UPDATE ON public.request_rate_limits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.consume_request_rate_limit(
  target_scope TEXT,
  target_bucket_key TEXT,
  max_hits INTEGER,
  window_seconds INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  hit_count INTEGER,
  retry_after_seconds INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_row public.request_rate_limits%ROWTYPE;
  current_instant TIMESTAMPTZ := NOW();
  reset_time TIMESTAMPTZ;
BEGIN
  IF max_hits <= 0 OR window_seconds <= 0 THEN
    RAISE EXCEPTION 'Rate limit configuration is invalid';
  END IF;

  SELECT *
  INTO current_row
  FROM public.request_rate_limits
  WHERE scope = target_scope
    AND bucket_key = target_bucket_key
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.request_rate_limits (
      scope,
      bucket_key,
      hits,
      window_started_at,
      last_hit_at
    )
    VALUES (
      target_scope,
      target_bucket_key,
      1,
      current_instant,
      current_instant
    );

    RETURN QUERY SELECT TRUE, 1, 0;
    RETURN;
  END IF;

  reset_time := current_row.window_started_at + make_interval(secs => window_seconds);

  IF current_instant >= reset_time THEN
    UPDATE public.request_rate_limits
    SET
      hits = 1,
      window_started_at = current_instant,
      last_hit_at = current_instant
    WHERE scope = target_scope
      AND bucket_key = target_bucket_key;

    RETURN QUERY SELECT TRUE, 1, 0;
    RETURN;
  END IF;

  IF current_row.hits >= max_hits THEN
    RETURN QUERY
    SELECT
      FALSE,
      current_row.hits,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (reset_time - current_instant)))::INTEGER);
    RETURN;
  END IF;

  UPDATE public.request_rate_limits
  SET
    hits = current_row.hits + 1,
    last_hit_at = current_instant
  WHERE scope = target_scope
    AND bucket_key = target_bucket_key;

  RETURN QUERY SELECT TRUE, current_row.hits + 1, 0;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_request_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_request_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;

CREATE TABLE IF NOT EXISTS public.billing_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  owner_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  billing_interval TEXT NOT NULL DEFAULT 'month',
  currency TEXT NOT NULL DEFAULT 'eur',
  amount_cents INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  stripe_price_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT billing_plans_code_not_blank
    CHECK (BTRIM(code) <> ''),
  CONSTRAINT billing_plans_name_not_blank
    CHECK (BTRIM(name) <> ''),
  CONSTRAINT billing_plans_owner_type_check
    CHECK (owner_type IN ('user', 'company')),
  CONSTRAINT billing_plans_interval_check
    CHECK (billing_interval IN ('month', 'year', 'custom')),
  CONSTRAINT billing_plans_amount_non_negative
    CHECK (amount_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_billing_plans_owner_active
  ON public.billing_plans(owner_type, active);

DROP TRIGGER IF EXISTS set_updated_at_billing_plans
  ON public.billing_plans;

CREATE TRIGGER set_updated_at_billing_plans
BEFORE UPDATE ON public.billing_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.billing_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_type TEXT NOT NULL,
  owner_user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  owner_company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'stripe',
  provider_customer_id TEXT UNIQUE,
  billing_email TEXT,
  current_billing_state TEXT NOT NULL DEFAULT 'inactive',
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT billing_accounts_owner_type_check
    CHECK (owner_type IN ('user', 'company')),
  CONSTRAINT billing_accounts_state_check
    CHECK (current_billing_state IN ('inactive', 'trialing', 'active', 'past_due', 'blocked')),
  CONSTRAINT billing_accounts_owner_scope_check
    CHECK (
      (owner_type = 'user' AND owner_user_id IS NOT NULL AND owner_company_id IS NULL)
      OR
      (owner_type = 'company' AND owner_company_id IS NOT NULL AND owner_user_id IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_accounts_owner_user
  ON public.billing_accounts(owner_user_id)
  WHERE owner_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_accounts_owner_company
  ON public.billing_accounts(owner_company_id)
  WHERE owner_company_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at_billing_accounts
  ON public.billing_accounts;

CREATE TRIGGER set_updated_at_billing_accounts
BEFORE UPDATE ON public.billing_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  billing_account_id UUID NOT NULL REFERENCES public.billing_accounts(id) ON DELETE CASCADE,
  billing_plan_id UUID REFERENCES public.billing_plans(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'stripe',
  provider_subscription_id TEXT NOT NULL UNIQUE,
  provider_price_id TEXT,
  status TEXT NOT NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT billing_subscriptions_status_check
    CHECK (status IN ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid'))
);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_account
  ON public.billing_subscriptions(billing_account_id, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_subscriptions_one_current
  ON public.billing_subscriptions(billing_account_id)
  WHERE status IN ('incomplete', 'trialing', 'active', 'past_due', 'unpaid');

DROP TRIGGER IF EXISTS set_updated_at_billing_subscriptions
  ON public.billing_subscriptions;

CREATE TRIGGER set_updated_at_billing_subscriptions
BEFORE UPDATE ON public.billing_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  billing_account_id UUID NOT NULL REFERENCES public.billing_accounts(id) ON DELETE CASCADE,
  billing_subscription_id UUID REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'stripe',
  provider_invoice_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'eur',
  amount_due_cents INTEGER NOT NULL DEFAULT 0,
  amount_paid_cents INTEGER NOT NULL DEFAULT 0,
  hosted_invoice_url TEXT,
  invoice_pdf_url TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT billing_invoices_amount_due_non_negative
    CHECK (amount_due_cents >= 0),
  CONSTRAINT billing_invoices_amount_paid_non_negative
    CHECK (amount_paid_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_account
  ON public.billing_invoices(billing_account_id, created_at DESC);

DROP TRIGGER IF EXISTS set_updated_at_billing_invoices
  ON public.billing_invoices;

CREATE TRIGGER set_updated_at_billing_invoices
BEFORE UPDATE ON public.billing_invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL DEFAULT 'stripe',
  provider_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_processed
  ON public.billing_webhook_events(provider, processed, created_at DESC);

INSERT INTO public.billing_plans (
  code,
  owner_type,
  name,
  description,
  billing_interval,
  currency,
  amount_cents,
  active
)
VALUES
  (
    'user_monthly_v1',
    'user',
    'Plan individual mensual',
    'Plan individual base para activar el acceso del empleado.',
    'month',
    'eur',
    0,
    TRUE
  ),
  (
    'company_monthly_v1',
    'company',
    'Plan empresa mensual',
    'Plan corporativo preparado para activar acceso por compania.',
    'month',
    'eur',
    0,
    FALSE
  )
ON CONFLICT (code) DO UPDATE
SET
  owner_type = EXCLUDED.owner_type,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  billing_interval = EXCLUDED.billing_interval,
  currency = EXCLUDED.currency,
  active = EXCLUDED.active;
