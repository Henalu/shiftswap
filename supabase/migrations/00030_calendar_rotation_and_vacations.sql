-- Migration: Calendar system — 3T5 rotation patterns, normal schedule, vacations
-- Adds: rotation_patterns, rotation_groups, area_schedule_configs,
--        user_rotation_assignments, vacations, schedule_overrides
-- Extends: shifts.shift_type with normal_full and normal_short

-- ============================================
-- 1. Extend shift_type with normal schedule
-- ============================================

ALTER TABLE public.shifts
  DROP CONSTRAINT IF EXISTS shifts_shift_type_check;

ALTER TABLE public.shifts
  ADD CONSTRAINT shifts_shift_type_check
  CHECK (shift_type IN ('morning', 'afternoon', 'night', 'normal_full', 'normal_short'));

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
    WHEN 'normal_full' THEN
      NEW.start_time = TIME '08:00';
      NEW.end_time = TIME '16:00';
    WHEN 'normal_short' THEN
      NEW.start_time = TIME '08:00';
      NEW.end_time = TIME '14:00';
    ELSE
      RAISE EXCEPTION 'Invalid shift_type: %', NEW.shift_type
        USING ERRCODE = '23514';
  END CASE;

  RETURN NEW;
END;
$$;

-- ============================================
-- 2. Rotation patterns (static reference data)
-- ============================================

CREATE TABLE IF NOT EXISTS public.rotation_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  sequence TEXT[] NOT NULL,
  cycle_length INT GENERATED ALWAYS AS (array_length(sequence, 1)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.rotation_patterns (code, label, sequence) VALUES
  ('MMTNN', 'Grupo A (2M+1T+2N+3D)', ARRAY['M','M','T','N','N','D','D','D']),
  ('MMTTN', 'Grupos B/C (2M+2T+1N+4D)', ARRAY['M','M','T','T','N','D','D','D','D']),
  ('MTTNN', 'Grupos D/E (1M+2T+2N+3D)', ARRAY['M','T','T','N','N','D','D','D']);

ALTER TABLE public.rotation_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view rotation patterns"
  ON public.rotation_patterns
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.rotation_patterns TO authenticated;

-- ============================================
-- 3. Rotation groups (A-E with reference dates)
-- ============================================

CREATE TABLE IF NOT EXISTS public.rotation_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  rotation_pattern_id UUID NOT NULL REFERENCES public.rotation_patterns(id),
  reference_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.rotation_groups (code, label, rotation_pattern_id, reference_date)
SELECT 'A', 'Grupo A', rp.id, DATE '2026-01-04'
FROM public.rotation_patterns rp WHERE rp.code = 'MMTNN'
UNION ALL
SELECT 'B', 'Grupo B', rp.id, DATE '2026-01-07'
FROM public.rotation_patterns rp WHERE rp.code = 'MMTTN'
UNION ALL
SELECT 'C', 'Grupo C', rp.id, DATE '2026-01-02'
FROM public.rotation_patterns rp WHERE rp.code = 'MMTTN'
UNION ALL
SELECT 'D', 'Grupo D', rp.id, DATE '2026-01-01'
FROM public.rotation_patterns rp WHERE rp.code = 'MTTNN'
UNION ALL
SELECT 'E', 'Grupo E', rp.id, DATE '2026-01-06'
FROM public.rotation_patterns rp WHERE rp.code = 'MTTNN';

ALTER TABLE public.rotation_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view rotation groups"
  ON public.rotation_groups
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.rotation_groups TO authenticated;

-- ============================================
-- 4. Area schedule configs (per area/taller)
-- ============================================

CREATE TABLE IF NOT EXISTS public.area_schedule_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('3t5', 'jornada_normal')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (department_id)
);

CREATE INDEX IF NOT EXISTS idx_area_schedule_configs_department
  ON public.area_schedule_configs(department_id);

CREATE TRIGGER set_updated_at_area_schedule_configs
BEFORE UPDATE ON public.area_schedule_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.area_schedule_configs ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users in same company (resolved via department join)
CREATE POLICY "Users can view area schedule configs in own company"
  ON public.area_schedule_configs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = area_schedule_configs.department_id
        AND d.company_id = public.get_user_company(auth.uid())
    )
    OR public.get_user_role(auth.uid()) = 'super_admin'
  );

-- INSERT/UPDATE/DELETE: admins with scope
CREATE POLICY "Admins can manage area schedule configs"
  ON public.area_schedule_configs
  FOR ALL
  TO authenticated
  USING (
    public.get_user_role(auth.uid()) IN ('hr_admin', 'super_admin')
    OR (
      public.get_user_role(auth.uid()) = 'department_admin'
      AND EXISTS (
        SELECT 1 FROM public.departments d
        WHERE d.id = area_schedule_configs.department_id
          AND d.company_id = public.get_user_company(auth.uid())
      )
    )
  )
  WITH CHECK (
    public.get_user_role(auth.uid()) IN ('hr_admin', 'super_admin')
    OR (
      public.get_user_role(auth.uid()) = 'department_admin'
      AND EXISTS (
        SELECT 1 FROM public.departments d
        WHERE d.id = area_schedule_configs.department_id
          AND d.company_id = public.get_user_company(auth.uid())
      )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.area_schedule_configs TO authenticated;

-- ============================================
-- 5. User rotation assignments (user -> group)
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_rotation_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  rotation_group_id UUID NOT NULL REFERENCES public.rotation_groups(id),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_rotation_assignments_user
  ON public.user_rotation_assignments(user_id);

CREATE INDEX IF NOT EXISTS idx_user_rotation_assignments_group
  ON public.user_rotation_assignments(rotation_group_id);

CREATE TRIGGER set_updated_at_user_rotation_assignments
BEFORE UPDATE ON public.user_rotation_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.user_rotation_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view rotation assignments in own company"
  ON public.user_rotation_assignments
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = user_rotation_assignments.user_id
        AND up.company_id = public.get_user_company(auth.uid())
    )
    OR public.get_user_role(auth.uid()) = 'super_admin'
  );

CREATE POLICY "Admins can manage rotation assignments"
  ON public.user_rotation_assignments
  FOR ALL
  TO authenticated
  USING (
    public.get_user_role(auth.uid()) IN ('hr_admin', 'super_admin')
    OR (
      public.get_user_role(auth.uid()) = 'department_admin'
      AND EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = user_rotation_assignments.user_id
          AND up.company_id = public.get_user_company(auth.uid())
          AND up.department_id = public.get_user_department(auth.uid())
      )
    )
  )
  WITH CHECK (
    public.get_user_role(auth.uid()) IN ('hr_admin', 'super_admin')
    OR (
      public.get_user_role(auth.uid()) = 'department_admin'
      AND EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = user_rotation_assignments.user_id
          AND up.company_id = public.get_user_company(auth.uid())
          AND up.department_id = public.get_user_department(auth.uid())
      )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_rotation_assignments TO authenticated;

-- ============================================
-- 6. Vacations (user self-service)
-- ============================================

CREATE TABLE IF NOT EXISTS public.vacations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vacations_dates_valid CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_vacations_user ON public.vacations(user_id);
CREATE INDEX IF NOT EXISTS idx_vacations_dates ON public.vacations(user_id, start_date, end_date);

CREATE TRIGGER set_updated_at_vacations
BEFORE UPDATE ON public.vacations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.vacations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own vacations"
  ON public.vacations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own vacations"
  ON public.vacations
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view scoped vacations"
  ON public.vacations
  FOR SELECT
  TO authenticated
  USING (
    public.get_user_role(auth.uid()) = 'super_admin'
    OR (
      public.get_user_role(auth.uid()) IN ('hr_admin', 'department_admin')
      AND EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = vacations.user_id
          AND up.company_id = public.get_user_company(auth.uid())
      )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vacations TO authenticated;

-- ============================================
-- 7. Schedule overrides (admin exceptions)
-- ============================================

CREATE TABLE IF NOT EXISTS public.schedule_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  override_type TEXT NOT NULL CHECK (
    override_type IN ('morning', 'afternoon', 'night', 'rest', 'normal_full', 'normal_short')
  ),
  reason TEXT,
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_schedule_overrides_user_date
  ON public.schedule_overrides(user_id, date);

ALTER TABLE public.schedule_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own schedule overrides"
  ON public.schedule_overrides
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage schedule overrides"
  ON public.schedule_overrides
  FOR ALL
  TO authenticated
  USING (
    public.get_user_role(auth.uid()) IN ('hr_admin', 'super_admin')
    OR (
      public.get_user_role(auth.uid()) = 'department_admin'
      AND EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = schedule_overrides.user_id
          AND up.company_id = public.get_user_company(auth.uid())
          AND up.department_id = public.get_user_department(auth.uid())
      )
    )
  )
  WITH CHECK (
    public.get_user_role(auth.uid()) IN ('hr_admin', 'super_admin')
    OR (
      public.get_user_role(auth.uid()) = 'department_admin'
      AND EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = schedule_overrides.user_id
          AND up.company_id = public.get_user_company(auth.uid())
          AND up.department_id = public.get_user_department(auth.uid())
      )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_overrides TO authenticated;
