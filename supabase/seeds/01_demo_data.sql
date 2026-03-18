-- ShiftSwap — Demo seed data
-- Safe to run multiple times (uses ON CONFLICT DO NOTHING)

-- Company
INSERT INTO companies (id, name, slug, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Empresa Demo',
  'empresa-demo',
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Para promocionar un usuario existente a super_admin, ejecutar manualmente:
-- UPDATE user_profiles
-- SET role = 'super_admin',
--     company_id = NULL,
--     department_id = NULL,
--     validation_status = 'approved',
--     validated_at = NOW(),
--     validation_notes = 'Bootstrapped as platform super admin'
-- WHERE id = '<user_uuid>';

-- Departments
INSERT INTO departments (id, company_id, name, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Mantenimiento', now()),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Producción',    now()),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Logística',     now())
ON CONFLICT (id) DO NOTHING;
