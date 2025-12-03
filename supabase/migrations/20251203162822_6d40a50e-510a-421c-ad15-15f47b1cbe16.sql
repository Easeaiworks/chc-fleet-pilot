-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can manage vehicles" ON public.vehicles;

-- Create policies for admin/manager only management
CREATE POLICY "Admins and managers can insert vehicles"
ON public.vehicles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins and managers can update vehicles"
ON public.vehicles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager')
  )
);

CREATE POLICY "Admins and managers can delete vehicles"
ON public.vehicles
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager')
  )
);