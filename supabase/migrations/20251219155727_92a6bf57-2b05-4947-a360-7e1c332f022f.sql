-- Drop the security definer view (it's a security risk)
DROP VIEW IF EXISTS public.vehicles_secure;

-- Instead, we'll handle this at the application level
-- The transponder_407 field access will be controlled in the frontend code
-- by checking if user is admin/manager before displaying it