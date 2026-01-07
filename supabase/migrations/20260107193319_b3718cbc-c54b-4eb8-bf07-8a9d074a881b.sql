-- Add explicit authentication requirement policies for all flagged tables
-- These are permissive policies that require authentication as a baseline

-- profiles table - require authentication for viewing
CREATE POLICY "Require authentication for profiles"
ON public.profiles
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

-- vendors table - require authentication for viewing
CREATE POLICY "Require authentication for vendors"
ON public.vendors
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

-- vehicles table - require authentication for viewing
CREATE POLICY "Require authentication for vehicles"
ON public.vehicles
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

-- expenses table - require authentication for viewing
CREATE POLICY "Require authentication for expenses"
ON public.expenses
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

-- vehicle_inspections table - require authentication for viewing
CREATE POLICY "Require authentication for vehicle_inspections"
ON public.vehicle_inspections
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

-- audit_logs table - require authentication for viewing
CREATE POLICY "Require authentication for audit_logs"
ON public.audit_logs
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

-- user_roles table - require authentication for viewing
CREATE POLICY "Require authentication for user_roles"
ON public.user_roles
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

-- Also add authentication requirements for other tables that may be missing them
-- branches
CREATE POLICY "Require authentication for branches"
ON public.branches
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

-- documents
CREATE POLICY "Require authentication for documents"
ON public.documents
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

-- expense_categories
CREATE POLICY "Require authentication for expense_categories"
ON public.expense_categories
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

-- fuel_receipts
CREATE POLICY "Require authentication for fuel_receipts"
ON public.fuel_receipts
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

-- gps_uploads
CREATE POLICY "Require authentication for gps_uploads"
ON public.gps_uploads
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

-- manager_approvers
CREATE POLICY "Require authentication for manager_approvers"
ON public.manager_approvers
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

-- tire_changes
CREATE POLICY "Require authentication for tire_changes"
ON public.tire_changes
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

-- tire_claim_requests
CREATE POLICY "Require authentication for tire_claim_requests"
ON public.tire_claim_requests
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);

-- tire_inventory
CREATE POLICY "Require authentication for tire_inventory"
ON public.tire_inventory
FOR SELECT
TO public
USING (auth.uid() IS NOT NULL);