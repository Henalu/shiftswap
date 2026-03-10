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

-- Departments
INSERT INTO departments (id, company_id, name, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Mantenimiento', now()),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Producción',    now()),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Logística',     now())
ON CONFLICT (id) DO NOTHING;
