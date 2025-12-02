-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (is_admin(auth.uid()));

-- Allow admins to view all user roles (they can currently only see their own)
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (is_admin(auth.uid()));