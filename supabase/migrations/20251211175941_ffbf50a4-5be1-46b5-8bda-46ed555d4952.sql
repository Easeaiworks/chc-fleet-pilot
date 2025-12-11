-- Fix profiles table: Remove overly permissive admin SELECT policy and create proper one
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Recreate admin policy to only allow admins to view profiles (using security definer function)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (is_admin(auth.uid()));

-- Add RLS policies for audit_logs table
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs
FOR SELECT
USING (is_admin(auth.uid()));

-- System can insert audit logs (no user restrictions on insert since it's done by triggers/system)
CREATE POLICY "System can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (true);

-- No one can update or delete audit logs (immutable audit trail)
-- (No UPDATE or DELETE policies means these operations are denied by RLS)