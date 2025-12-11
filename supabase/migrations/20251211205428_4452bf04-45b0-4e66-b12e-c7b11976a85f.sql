-- Create a security definer function to check if user is approved and not blocked
CREATE OR REPLACE FUNCTION public.is_user_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
    AND is_approved = true
    AND is_blocked = false
  )
$$;

-- Drop and recreate policies for vehicles table with approval check
DROP POLICY IF EXISTS "Authenticated users can view vehicles" ON public.vehicles;
CREATE POLICY "Approved users can view vehicles" ON public.vehicles
FOR SELECT USING (is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Admins and managers can insert vehicles" ON public.vehicles;
CREATE POLICY "Approved admins and managers can insert vehicles" ON public.vehicles
FOR INSERT WITH CHECK (
  is_user_approved(auth.uid()) AND
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
);

DROP POLICY IF EXISTS "Admins and managers can update vehicles" ON public.vehicles;
CREATE POLICY "Approved admins and managers can update vehicles" ON public.vehicles
FOR UPDATE USING (
  is_user_approved(auth.uid()) AND
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
);

DROP POLICY IF EXISTS "Admins and managers can delete vehicles" ON public.vehicles;
CREATE POLICY "Approved admins and managers can delete vehicles" ON public.vehicles
FOR DELETE USING (
  is_user_approved(auth.uid()) AND
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
);

-- Drop and recreate policies for expenses table with approval check
DROP POLICY IF EXISTS "Authenticated users can view expenses" ON public.expenses;
CREATE POLICY "Approved users can view expenses" ON public.expenses
FOR SELECT USING (is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can manage expenses" ON public.expenses;

DROP POLICY IF EXISTS "Staff can create expenses" ON public.expenses;
CREATE POLICY "Approved staff can create expenses" ON public.expenses
FOR INSERT WITH CHECK (is_user_approved(auth.uid()) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Staff can update own pending expenses" ON public.expenses;
CREATE POLICY "Approved staff can update own pending expenses" ON public.expenses
FOR UPDATE USING (
  is_user_approved(auth.uid()) AND created_by = auth.uid() AND approval_status = 'pending'
) WITH CHECK (
  is_user_approved(auth.uid()) AND created_by = auth.uid() AND approval_status = 'pending'
);

DROP POLICY IF EXISTS "Admins and managers can update any expense" ON public.expenses;
CREATE POLICY "Approved admins and managers can update any expense" ON public.expenses
FOR UPDATE USING (
  is_user_approved(auth.uid()) AND
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
) WITH CHECK (
  is_user_approved(auth.uid()) AND
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
);

DROP POLICY IF EXISTS "Admins and managers can delete expenses" ON public.expenses;
CREATE POLICY "Approved admins and managers can delete expenses" ON public.expenses
FOR DELETE USING (
  is_user_approved(auth.uid()) AND
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
);

-- Drop and recreate policies for branches table with approval check
DROP POLICY IF EXISTS "Authenticated users can view branches" ON public.branches;
CREATE POLICY "Approved users can view branches" ON public.branches
FOR SELECT USING (is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can manage branches" ON public.branches;
CREATE POLICY "Approved admins and managers can manage branches" ON public.branches
FOR ALL USING (
  is_user_approved(auth.uid()) AND
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
) WITH CHECK (
  is_user_approved(auth.uid()) AND
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
);

-- Drop and recreate policies for expense_categories table with approval check
DROP POLICY IF EXISTS "Authenticated users can view categories" ON public.expense_categories;
CREATE POLICY "Approved users can view categories" ON public.expense_categories
FOR SELECT USING (is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can manage categories" ON public.expense_categories;
CREATE POLICY "Approved admins and managers can manage categories" ON public.expense_categories
FOR ALL USING (
  is_user_approved(auth.uid()) AND
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
) WITH CHECK (
  is_user_approved(auth.uid()) AND
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
);

-- Drop and recreate policies for documents table with approval check
DROP POLICY IF EXISTS "Authenticated users can view documents" ON public.documents;
CREATE POLICY "Approved users can view documents" ON public.documents
FOR SELECT USING (is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can manage documents" ON public.documents;
CREATE POLICY "Approved users can manage documents" ON public.documents
FOR ALL USING (is_user_approved(auth.uid())) WITH CHECK (is_user_approved(auth.uid()));

-- Drop and recreate policies for gps_uploads table with approval check
DROP POLICY IF EXISTS "Authenticated users can view gps_uploads" ON public.gps_uploads;
CREATE POLICY "Approved users can view gps_uploads" ON public.gps_uploads
FOR SELECT USING (is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can manage gps_uploads" ON public.gps_uploads;
CREATE POLICY "Approved users can manage gps_uploads" ON public.gps_uploads
FOR ALL USING (is_user_approved(auth.uid())) WITH CHECK (is_user_approved(auth.uid()));

-- Drop and recreate policies for tire_changes table with approval check
DROP POLICY IF EXISTS "Authenticated users can view tire changes" ON public.tire_changes;
CREATE POLICY "Approved users can view tire changes" ON public.tire_changes
FOR SELECT USING (is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Admins and managers can manage tire changes" ON public.tire_changes;
CREATE POLICY "Approved admins and managers can manage tire changes" ON public.tire_changes
FOR ALL USING (
  is_user_approved(auth.uid()) AND
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
) WITH CHECK (
  is_user_approved(auth.uid()) AND
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
);

DROP POLICY IF EXISTS "Staff can insert tire changes" ON public.tire_changes;
CREATE POLICY "Approved staff can insert tire changes" ON public.tire_changes
FOR INSERT WITH CHECK (is_user_approved(auth.uid()));

-- Drop and recreate policies for tire_inventory table with approval check
DROP POLICY IF EXISTS "Authenticated users can view tire inventory" ON public.tire_inventory;
CREATE POLICY "Approved users can view tire inventory" ON public.tire_inventory
FOR SELECT USING (is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Admins and managers can manage tire inventory" ON public.tire_inventory;
CREATE POLICY "Approved admins and managers can manage tire inventory" ON public.tire_inventory
FOR ALL USING (
  is_user_approved(auth.uid()) AND
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
) WITH CHECK (
  is_user_approved(auth.uid()) AND
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
);

DROP POLICY IF EXISTS "Staff can insert tire inventory" ON public.tire_inventory;
CREATE POLICY "Approved staff can insert tire inventory" ON public.tire_inventory
FOR INSERT WITH CHECK (is_user_approved(auth.uid()));

-- Drop and recreate policies for tire_claim_requests table with approval check
DROP POLICY IF EXISTS "Authenticated users can view tire claim requests" ON public.tire_claim_requests;
CREATE POLICY "Approved users can view tire claim requests" ON public.tire_claim_requests
FOR SELECT USING (is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Staff can create tire claim requests" ON public.tire_claim_requests;
CREATE POLICY "Approved staff can create tire claim requests" ON public.tire_claim_requests
FOR INSERT WITH CHECK (is_user_approved(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage tire claim requests" ON public.tire_claim_requests;
CREATE POLICY "Approved admins can manage tire claim requests" ON public.tire_claim_requests
FOR ALL USING (
  is_user_approved(auth.uid()) AND
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Users can update their own pending requests" ON public.tire_claim_requests;
CREATE POLICY "Approved users can update their own pending requests" ON public.tire_claim_requests
FOR UPDATE USING (
  is_user_approved(auth.uid()) AND requested_by = auth.uid() AND status = 'pending'
) WITH CHECK (
  is_user_approved(auth.uid()) AND requested_by = auth.uid() AND status = 'pending'
);

DROP POLICY IF EXISTS "Users can delete their own pending requests" ON public.tire_claim_requests;
CREATE POLICY "Approved users can delete their own pending requests" ON public.tire_claim_requests
FOR DELETE USING (
  is_user_approved(auth.uid()) AND requested_by = auth.uid() AND status = 'pending'
);

-- Update audit_logs policies to ensure tamper-proof audit trail
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
-- Only allow inserts via service role or triggers, not regular users
CREATE POLICY "Only system can insert audit logs" ON public.audit_logs
FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Approved admins can view audit logs" ON public.audit_logs
FOR SELECT USING (is_user_approved(auth.uid()) AND is_admin(auth.uid()));