-- Add approval fields to expenses table
ALTER TABLE public.expenses 
  ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Update existing expenses to be approved
UPDATE public.expenses SET approval_status = 'approved' WHERE approval_status IS NULL;

-- Update RLS policies for expenses
DROP POLICY IF EXISTS "Staff can create expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins and managers can update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins and managers can delete expenses" ON public.expenses;

-- Staff can create their own expenses (will be pending by default)
CREATE POLICY "Staff can create expenses"
  ON public.expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Staff can update their own pending expenses
CREATE POLICY "Staff can update own pending expenses"
  ON public.expenses
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() AND approval_status = 'pending')
  WITH CHECK (created_by = auth.uid() AND approval_status = 'pending');

-- Admins and managers can update any expense
CREATE POLICY "Admins and managers can update any expense"
  ON public.expenses
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'manager')
    )
  );

-- Admins and managers can delete expenses
CREATE POLICY "Admins and managers can delete expenses"
  ON public.expenses
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'manager')
    )
  );