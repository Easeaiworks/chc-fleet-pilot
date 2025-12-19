-- Fix 1: Add explicit DENY policies for UPDATE and DELETE on audit_logs
CREATE POLICY "No one can update audit logs" 
ON public.audit_logs 
FOR UPDATE 
USING (false);

CREATE POLICY "No one can delete audit logs" 
ON public.audit_logs 
FOR DELETE 
USING (false);

-- Fix 2: Create a function to check if user is admin or manager (for sensitive data access)
CREATE OR REPLACE FUNCTION public.is_admin_or_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
    AND role IN ('admin', 'manager')
  )
$$;

-- Fix 3: Create a secure view for vehicles that hides transponder from non-admin/manager users
CREATE OR REPLACE VIEW public.vehicles_secure AS
SELECT 
  id,
  plate,
  vin,
  make,
  model,
  year,
  status,
  branch_id,
  odometer_km,
  last_oil_change_km,
  notes,
  current_tire_type,
  summer_tire_location,
  winter_tire_location,
  summer_tire_brand,
  summer_tire_measurements,
  summer_tire_condition,
  winter_tire_brand,
  winter_tire_measurements,
  winter_tire_condition,
  tire_notes,
  last_tire_change_date,
  created_at,
  updated_at,
  CASE 
    WHEN is_admin_or_manager(auth.uid()) THEN transponder_407
    ELSE NULL
  END AS transponder_407
FROM public.vehicles;