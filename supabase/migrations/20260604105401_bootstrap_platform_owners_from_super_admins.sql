-- Keep existing global ShiftSwap administrators able to access the new
-- separated platform console. Future platform access is managed through
-- public.platform_admins, not user_profiles.role.

INSERT INTO public.platform_admins (
  user_id,
  role,
  status,
  display_name,
  created_at,
  updated_at
)
SELECT
  profile.id,
  'platform_owner',
  'active',
  NULLIF(BTRIM(profile.full_name), ''),
  NOW(),
  NOW()
FROM public.user_profiles AS profile
WHERE profile.role = 'super_admin'
  AND profile.validation_status = 'approved'
ON CONFLICT (user_id) DO UPDATE
SET
  role = 'platform_owner',
  status = 'active',
  display_name = COALESCE(
    public.platform_admins.display_name,
    EXCLUDED.display_name
  ),
  updated_at = NOW();
