-- Platform console access lives outside company-scoped user roles.
-- Bootstrap the first platform owner manually after deploy:
-- INSERT INTO public.platform_admins (user_id, role, status, display_name)
-- SELECT id, 'platform_owner', 'active', email
-- FROM auth.users
-- WHERE email = 'tu-email@dominio.com'
-- ON CONFLICT (user_id) DO UPDATE
-- SET role = 'platform_owner', status = 'active', updated_at = NOW();

CREATE TABLE IF NOT EXISTS public.platform_admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer',
  status TEXT NOT NULL DEFAULT 'active',
  display_name TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_admins_role_check
    CHECK (role IN ('platform_owner', 'support', 'viewer')),
  CONSTRAINT platform_admins_status_check
    CHECK (status IN ('active', 'inactive', 'suspended')),
  CONSTRAINT platform_admins_display_name_safe
    CHECK (
      display_name IS NULL
      OR (BTRIM(display_name) <> '' AND CHAR_LENGTH(display_name) <= 80)
    ),
  CONSTRAINT platform_admins_notes_safe
    CHECK (notes IS NULL OR CHAR_LENGTH(notes) <= 500)
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_admins_user_id_key
  ON public.platform_admins(user_id);

CREATE INDEX IF NOT EXISTS platform_admins_user_status_idx
  ON public.platform_admins(user_id, status);

CREATE INDEX IF NOT EXISTS platform_admins_role_status_idx
  ON public.platform_admins(role, status);

DROP TRIGGER IF EXISTS platform_admins_set_updated_at
  ON public.platform_admins;

CREATE TRIGGER platform_admins_set_updated_at
BEFORE UPDATE ON public.platform_admins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.platform_audit_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_platform_admin_id UUID REFERENCES public.platform_admins(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_audit_events_action_safe
    CHECK (BTRIM(action) <> '' AND CHAR_LENGTH(action) <= 80),
  CONSTRAINT platform_audit_events_target_type_safe
    CHECK (BTRIM(target_type) <> '' AND CHAR_LENGTH(target_type) <= 80),
  CONSTRAINT platform_audit_events_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT platform_audit_events_metadata_size
    CHECK (CHAR_LENGTH(metadata::TEXT) <= 5000)
);

CREATE INDEX IF NOT EXISTS platform_audit_events_actor_idx
  ON public.platform_audit_events(actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS platform_audit_events_company_idx
  ON public.platform_audit_events(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS platform_audit_events_action_idx
  ON public.platform_audit_events(action, created_at DESC);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_audit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.platform_admins FROM PUBLIC;
REVOKE ALL ON public.platform_audit_events FROM PUBLIC;
REVOKE ALL ON public.platform_admins FROM anon, authenticated;
REVOKE ALL ON public.platform_audit_events FROM anon, authenticated;

GRANT ALL ON public.platform_admins TO service_role;
GRANT ALL ON public.platform_audit_events TO service_role;
