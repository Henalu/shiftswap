-- Store tenant-scoped visual settings for company dashboards.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS theme_config jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_theme_config_is_object
  CHECK (jsonb_typeof(theme_config) = 'object');
