-- Drop the existing ALL policy for admins and managers
DROP POLICY IF EXISTS "Approved admins and managers can manage tire inventory" ON public.tire_inventory;

-- Create separate policies for granular control

-- Admins and managers can INSERT
CREATE POLICY "Approved admins and managers can insert tire inventory" 
ON public.tire_inventory 
FOR INSERT 
WITH CHECK (
  is_user_approved(auth.uid()) AND (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = ANY (ARRAY['admin'::text, 'manager'::text])
    )
  )
);

-- Only admins can UPDATE
CREATE POLICY "Approved admins can update tire inventory" 
ON public.tire_inventory 
FOR UPDATE 
USING (
  is_user_approved(auth.uid()) AND is_admin(auth.uid())
)
WITH CHECK (
  is_user_approved(auth.uid()) AND is_admin(auth.uid())
);

-- Only admins can DELETE
CREATE POLICY "Approved admins can delete tire inventory" 
ON public.tire_inventory 
FOR DELETE 
USING (
  is_user_approved(auth.uid()) AND is_admin(auth.uid())
);