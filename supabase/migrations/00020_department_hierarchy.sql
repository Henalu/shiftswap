-- Migration: add hierarchical departments support
-- Goal: allow root departments and nested subdepartments within the same company

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS parent_department_id UUID NULL;

ALTER TABLE public.departments
  DROP CONSTRAINT IF EXISTS departments_company_id_name_key;

ALTER TABLE public.departments
  DROP CONSTRAINT IF EXISTS departments_company_id_id_key;

ALTER TABLE public.departments
  ADD CONSTRAINT departments_company_id_id_key
  UNIQUE (company_id, id);

ALTER TABLE public.departments
  DROP CONSTRAINT IF EXISTS departments_parent_department_fk;

ALTER TABLE public.departments
  ADD CONSTRAINT departments_parent_department_fk
  FOREIGN KEY (company_id, parent_department_id)
  REFERENCES public.departments(company_id, id)
  ON DELETE RESTRICT;

ALTER TABLE public.departments
  DROP CONSTRAINT IF EXISTS departments_parent_department_not_self;

ALTER TABLE public.departments
  ADD CONSTRAINT departments_parent_department_not_self
  CHECK (parent_department_id IS NULL OR parent_department_id <> id);

CREATE INDEX IF NOT EXISTS idx_departments_parent
  ON public.departments(parent_department_id);

CREATE INDEX IF NOT EXISTS idx_departments_company_parent
  ON public.departments(company_id, parent_department_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_unique_root_name
  ON public.departments(company_id, name)
  WHERE parent_department_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_unique_child_name
  ON public.departments(company_id, parent_department_id, name)
  WHERE parent_department_id IS NOT NULL;
