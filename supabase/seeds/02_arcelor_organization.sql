-- ShiftSwap - Arcelor organization seed
-- Requires migrations 00020_department_hierarchy.sql and
-- 00021_department_scope_and_change_requests.sql
-- Safe to run multiple times. Creates or reuses the company and its hierarchy.

DO $$
DECLARE
  v_company_id UUID;
  v_aceria_ldg_id UUID;
  v_department_id UUID;
BEGIN
  SELECT id
  INTO v_company_id
  FROM public.companies
  WHERE slug = 'arcelor'
  LIMIT 1;

  IF v_company_id IS NULL THEN
    INSERT INTO public.companies (name, slug, created_at)
    VALUES ('Arcelor', 'arcelor', NOW())
    RETURNING id INTO v_company_id;
  ELSE
    UPDATE public.companies
    SET name = 'Arcelor'
    WHERE id = v_company_id;
  END IF;

  SELECT id
  INTO v_aceria_ldg_id
  FROM public.departments
  WHERE company_id = v_company_id
    AND name = U&'Acer\00EDa LDG'
  ORDER BY CASE WHEN parent_department_id IS NULL THEN 0 ELSE 1 END, created_at
  LIMIT 1;

  IF v_aceria_ldg_id IS NULL THEN
    INSERT INTO public.departments (
      company_id,
      name,
      parent_department_id,
      is_assignable,
      created_at
    )
    VALUES (v_company_id, U&'Acer\00EDa LDG', NULL, FALSE, NOW())
    RETURNING id INTO v_aceria_ldg_id;
  ELSE
    UPDATE public.departments
    SET parent_department_id = NULL,
        is_assignable = FALSE
    WHERE id = v_aceria_ldg_id;
  END IF;

  SELECT id
  INTO v_department_id
  FROM public.departments
  WHERE company_id = v_company_id
    AND name = 'Carril'
  ORDER BY CASE WHEN parent_department_id IS NULL THEN 0 ELSE 1 END, created_at
  LIMIT 1;

  IF v_department_id IS NULL THEN
    INSERT INTO public.departments (
      company_id,
      name,
      parent_department_id,
      is_assignable,
      created_at
    )
    VALUES (v_company_id, 'Carril', NULL, TRUE, NOW());
  ELSE
    UPDATE public.departments
    SET parent_department_id = NULL,
        is_assignable = TRUE
    WHERE id = v_department_id;
  END IF;

  SELECT id
  INTO v_department_id
  FROM public.departments
  WHERE company_id = v_company_id
    AND name = U&'Alambr\00F3n'
  ORDER BY CASE WHEN parent_department_id IS NULL THEN 0 ELSE 1 END, created_at
  LIMIT 1;

  IF v_department_id IS NULL THEN
    INSERT INTO public.departments (
      company_id,
      name,
      parent_department_id,
      is_assignable,
      created_at
    )
    VALUES (v_company_id, U&'Alambr\00F3n', NULL, TRUE, NOW());
  ELSE
    UPDATE public.departments
    SET parent_department_id = NULL,
        is_assignable = TRUE
    WHERE id = v_department_id;
  END IF;

  SELECT id
  INTO v_department_id
  FROM public.departments
  WHERE company_id = v_company_id
    AND name = 'Otros'
  ORDER BY CASE WHEN parent_department_id IS NULL THEN 0 ELSE 1 END, created_at
  LIMIT 1;

  IF v_department_id IS NULL THEN
    INSERT INTO public.departments (
      company_id,
      name,
      parent_department_id,
      is_assignable,
      created_at
    )
    VALUES (v_company_id, 'Otros', NULL, TRUE, NOW());
  ELSE
    UPDATE public.departments
    SET parent_department_id = NULL,
        is_assignable = TRUE
    WHERE id = v_department_id;
  END IF;

  SELECT id
  INTO v_department_id
  FROM public.departments
  WHERE company_id = v_company_id
    AND name = U&'Producci\00F3n'
  ORDER BY CASE WHEN parent_department_id = v_aceria_ldg_id THEN 0 ELSE 1 END, created_at
  LIMIT 1;

  IF v_department_id IS NULL THEN
    INSERT INTO public.departments (
      company_id,
      name,
      parent_department_id,
      is_assignable,
      created_at
    )
    VALUES (v_company_id, U&'Producci\00F3n', v_aceria_ldg_id, TRUE, NOW());
  ELSE
    UPDATE public.departments
    SET parent_department_id = v_aceria_ldg_id,
        is_assignable = TRUE
    WHERE id = v_department_id;
  END IF;

  SELECT id
  INTO v_department_id
  FROM public.departments
  WHERE company_id = v_company_id
    AND name = U&'M\00E1quinas'
  ORDER BY CASE WHEN parent_department_id = v_aceria_ldg_id THEN 0 ELSE 1 END, created_at
  LIMIT 1;

  IF v_department_id IS NULL THEN
    INSERT INTO public.departments (
      company_id,
      name,
      parent_department_id,
      is_assignable,
      created_at
    )
    VALUES (v_company_id, U&'M\00E1quinas', v_aceria_ldg_id, TRUE, NOW());
  ELSE
    UPDATE public.departments
    SET parent_department_id = v_aceria_ldg_id,
        is_assignable = TRUE
    WHERE id = v_department_id;
  END IF;

  SELECT id
  INTO v_department_id
  FROM public.departments
  WHERE company_id = v_company_id
    AND name = U&'Mantenimiento mec\00E1nico'
  ORDER BY CASE WHEN parent_department_id = v_aceria_ldg_id THEN 0 ELSE 1 END, created_at
  LIMIT 1;

  IF v_department_id IS NULL THEN
    INSERT INTO public.departments (
      company_id,
      name,
      parent_department_id,
      is_assignable,
      created_at
    )
    VALUES (
      v_company_id,
      U&'Mantenimiento mec\00E1nico',
      v_aceria_ldg_id,
      TRUE,
      NOW()
    );
  ELSE
    UPDATE public.departments
    SET parent_department_id = v_aceria_ldg_id,
        is_assignable = TRUE
    WHERE id = v_department_id;
  END IF;

  SELECT id
  INTO v_department_id
  FROM public.departments
  WHERE company_id = v_company_id
    AND name = U&'Mantenimiento el\00E9ctrico'
  ORDER BY CASE WHEN parent_department_id = v_aceria_ldg_id THEN 0 ELSE 1 END, created_at
  LIMIT 1;

  IF v_department_id IS NULL THEN
    INSERT INTO public.departments (
      company_id,
      name,
      parent_department_id,
      is_assignable,
      created_at
    )
    VALUES (
      v_company_id,
      U&'Mantenimiento el\00E9ctrico',
      v_aceria_ldg_id,
      TRUE,
      NOW()
    );
  ELSE
    UPDATE public.departments
    SET parent_department_id = v_aceria_ldg_id,
        is_assignable = TRUE
    WHERE id = v_department_id;
  END IF;
END
$$ LANGUAGE plpgsql;

-- Example manual association for existing test users:
-- UPDATE public.user_profiles
-- SET company_id = (SELECT id FROM public.companies WHERE slug = 'arcelor'),
--     department_id = (
--       SELECT child.id
--       FROM public.departments child
--       JOIN public.departments parent ON parent.id = child.parent_department_id
--       JOIN public.companies company ON company.id = child.company_id
--       WHERE company.slug = 'arcelor'
--         AND parent.name = U&'Acer\00EDa LDG'
--         AND child.name = U&'Producci\00F3n'
--       LIMIT 1
--     )
-- WHERE email = 'usuario@ejemplo.com';
