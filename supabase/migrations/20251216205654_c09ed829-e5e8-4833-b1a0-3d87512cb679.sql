-- Drop existing delete policies that allow managers
DROP POLICY IF EXISTS "Approved admins and managers can delete vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Approved admins and managers can delete expenses" ON public.expenses;

-- Create new delete policies for admin only
CREATE POLICY "Approved admins can delete vehicles" 
ON public.vehicles 
FOR DELETE 
USING (is_user_approved(auth.uid()) AND is_admin(auth.uid()));

CREATE POLICY "Approved admins can delete expenses" 
ON public.expenses 
FOR DELETE 
USING (is_user_approved(auth.uid()) AND is_admin(auth.uid()));