-- Set the B2C launch price ladder and keep B2B plans hidden until the
-- company-seat invitation model is designed.

UPDATE public.billing_pricing_cohorts
SET
  discount_label = CASE code
    WHEN 'founder_20' THEN '50% sobre el precio final'
    WHEN 'early_70' THEN '33% sobre el precio final'
    WHEN 'growth_170' THEN '20% sobre el precio final'
    WHEN 'launch_200' THEN '10% sobre el precio final'
    WHEN 'standard' THEN 'Sin descuento promocional'
    ELSE discount_label
  END,
  description = CASE code
    WHEN 'founder_20' THEN 'Primeras 20 cuentas B2C: primer mes gratis y mayor descuento durante 12 meses.'
    WHEN 'early_70' THEN 'Cuentas B2C 21 a 70 con descuento alto durante 12 meses.'
    WHEN 'growth_170' THEN 'Cuentas B2C 71 a 170 con descuento medio durante 12 meses.'
    WHEN 'launch_200' THEN 'Cuentas B2C 171 a 200 con descuento de lanzamiento durante 12 meses.'
    WHEN 'standard' THEN 'Precio B2C final para nuevas cuentas una vez cerrado el programa early adopter.'
    ELSE description
  END
WHERE code IN ('founder_20', 'early_70', 'growth_170', 'launch_200', 'standard');

UPDATE public.billing_plans
SET
  active = FALSE,
  is_public = FALSE
WHERE owner_type = 'company';

UPDATE public.billing_plans
SET
  amount_cents = pricing.amount_cents,
  price_label = pricing.price_label,
  marketing_badge = pricing.marketing_badge,
  description = pricing.description
FROM (
  VALUES
    ('founder_20_monthly', 149, '1,49 EUR/mes IVA incluido', '1 mes gratis', 'Plan B2C mensual para las primeras 20 cuentas. Precio bloqueado durante 12 meses.'),
    ('founder_20_annual', 1499, '14,99 EUR/ano IVA incluido', 'Ahorro anual', 'Plan B2C anual para las primeras 20 cuentas. Precio bloqueado durante 12 meses.'),
    ('early_70_monthly', 199, '1,99 EUR/mes IVA incluido', 'Descuento alto', 'Plan B2C mensual para cuentas 21 a 70. Precio bloqueado durante 12 meses.'),
    ('early_70_annual', 1999, '19,99 EUR/ano IVA incluido', 'Ahorro anual', 'Plan B2C anual para cuentas 21 a 70. Precio bloqueado durante 12 meses.'),
    ('growth_170_monthly', 239, '2,39 EUR/mes IVA incluido', 'Descuento medio', 'Plan B2C mensual para cuentas 71 a 170. Precio bloqueado durante 12 meses.'),
    ('growth_170_annual', 2399, '23,99 EUR/ano IVA incluido', 'Ahorro anual', 'Plan B2C anual para cuentas 71 a 170. Precio bloqueado durante 12 meses.'),
    ('launch_200_monthly', 269, '2,69 EUR/mes IVA incluido', 'Descuento final', 'Plan B2C mensual para cuentas 171 a 200. Precio bloqueado durante 12 meses.'),
    ('launch_200_annual', 2699, '26,99 EUR/ano IVA incluido', 'Ahorro anual', 'Plan B2C anual para cuentas 171 a 200. Precio bloqueado durante 12 meses.'),
    ('standard_monthly', 299, '2,99 EUR/mes IVA incluido', 'Precio final', 'Plan B2C mensual estandar tras el programa early adopter.'),
    ('standard_annual', 2999, '29,99 EUR/ano IVA incluido', 'Ahorro anual', 'Plan B2C anual estandar con descuento frente al mensual.')
) AS pricing(code, amount_cents, price_label, marketing_badge, description)
WHERE public.billing_plans.code = pricing.code
  AND public.billing_plans.owner_type = 'user'
  AND public.billing_plans.is_public = TRUE;
