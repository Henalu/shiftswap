-- Migration: compensation terms for requester signature and hours-bank ledger.

ALTER TABLE public.exchanges
  ADD COLUMN IF NOT EXISTS agreement_type TEXT,
  ADD COLUMN IF NOT EXISTS compensation_shift_date DATE,
  ADD COLUMN IF NOT EXISTS compensation_shift_type TEXT;

ALTER TABLE public.exchanges
  DROP CONSTRAINT IF EXISTS exchanges_agreement_type_check;

ALTER TABLE public.exchanges
  ADD CONSTRAINT exchanges_agreement_type_check
  CHECK (
    agreement_type IS NULL
    OR agreement_type IN ('hours_bank', 'shift_exchange')
  );

ALTER TABLE public.exchanges
  DROP CONSTRAINT IF EXISTS exchanges_compensation_shift_type_check;

ALTER TABLE public.exchanges
  ADD CONSTRAINT exchanges_compensation_shift_type_check
  CHECK (
    compensation_shift_type IS NULL
    OR compensation_shift_type IN ('morning', 'afternoon', 'night')
  );

ALTER TABLE public.exchanges
  DROP CONSTRAINT IF EXISTS exchanges_compensation_terms_check;

ALTER TABLE public.exchanges
  ADD CONSTRAINT exchanges_compensation_terms_check
  CHECK (
    (
      agreement_type IS NULL
      AND compensation_shift_date IS NULL
      AND compensation_shift_type IS NULL
    )
    OR (
      agreement_type = 'hours_bank'
      AND compensation_shift_date IS NULL
      AND compensation_shift_type IS NULL
    )
    OR (
      agreement_type = 'shift_exchange'
      AND compensation_shift_date IS NOT NULL
      AND compensation_shift_type IS NOT NULL
    )
  );

CREATE INDEX IF NOT EXISTS idx_exchanges_agreement_type
  ON public.exchanges(agreement_type);

CREATE TABLE IF NOT EXISTS public.shift_debt_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exchange_id UUID NOT NULL REFERENCES public.exchanges(id) ON DELETE CASCADE,
  debtor_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  creditor_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL DEFAULT 'hours_bank_debt',
  units INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending_approval',
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  CONSTRAINT shift_debt_transactions_exchange_unique UNIQUE (exchange_id),
  CONSTRAINT shift_debt_transactions_movement_type_check
    CHECK (movement_type IN ('hours_bank_debt')),
  CONSTRAINT shift_debt_transactions_status_check
    CHECK (status IN ('pending_approval', 'active', 'voided', 'settled')),
  CONSTRAINT shift_debt_transactions_units_check
    CHECK (units > 0),
  CONSTRAINT shift_debt_transactions_users_check
    CHECK (debtor_user_id <> creditor_user_id)
);

CREATE INDEX IF NOT EXISTS idx_shift_debt_transactions_debtor
  ON public.shift_debt_transactions(debtor_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shift_debt_transactions_creditor
  ON public.shift_debt_transactions(creditor_user_id, status, created_at DESC);

ALTER TABLE public.shift_debt_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view related shift debt transactions"
  ON public.shift_debt_transactions;

CREATE POLICY "Participants can view related shift debt transactions"
  ON public.shift_debt_transactions
  FOR SELECT
  TO authenticated
  USING (
    debtor_user_id = auth.uid()
    OR creditor_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Scoped admins can view shift debt transactions"
  ON public.shift_debt_transactions;

CREATE POLICY "Scoped admins can view shift debt transactions"
  ON public.shift_debt_transactions
  FOR SELECT
  TO authenticated
  USING (
    public.get_user_role(auth.uid()) = 'super_admin'
    OR EXISTS (
      SELECT 1
      FROM public.exchanges e
      JOIN public.shifts s ON s.id = e.shift_id
      JOIN public.departments d ON d.id = s.department_id
      WHERE e.id = shift_debt_transactions.exchange_id
        AND (
          (
            public.get_user_role(auth.uid()) = 'hr_admin'
            AND d.company_id = public.get_user_company(auth.uid())
          )
          OR (
            public.get_user_role(auth.uid()) = 'department_admin'
            AND d.company_id = public.get_user_company(auth.uid())
            AND d.id = public.get_user_department(auth.uid())
          )
        )
    )
  );
