-- Create vendors table for matching receipt vendors
CREATE TABLE public.vendors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on vendors
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- Vendors are viewable by all approved users
CREATE POLICY "Approved users can view vendors" 
ON public.vendors 
FOR SELECT 
USING (is_user_approved(auth.uid()));

-- Admins and managers can manage vendors
CREATE POLICY "Approved admins and managers can manage vendors" 
ON public.vendors 
FOR ALL 
USING (is_user_approved(auth.uid()) AND is_admin_or_manager(auth.uid()))
WITH CHECK (is_user_approved(auth.uid()) AND is_admin_or_manager(auth.uid()));

-- Create manager_approvers table for dropdown list
CREATE TABLE public.manager_approvers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on manager_approvers
ALTER TABLE public.manager_approvers ENABLE ROW LEVEL SECURITY;

-- All approved users can view manager approvers
CREATE POLICY "Approved users can view manager approvers" 
ON public.manager_approvers 
FOR SELECT 
USING (is_user_approved(auth.uid()));

-- Admins can manage manager approvers
CREATE POLICY "Admins can manage manager approvers" 
ON public.manager_approvers 
FOR ALL 
USING (is_user_approved(auth.uid()) AND is_admin(auth.uid()))
WITH CHECK (is_user_approved(auth.uid()) AND is_admin(auth.uid()));

-- Insert the default manager approvers
INSERT INTO public.manager_approvers (name) VALUES 
  ('Frank C'),
  ('Gabe'),
  ('Manny'),
  ('Adriano'),
  ('Pino');

-- Add new columns to expenses table for enhanced tracking
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id),
ADD COLUMN IF NOT EXISTS vendor_name TEXT,
ADD COLUMN IF NOT EXISTS staff_name TEXT,
ADD COLUMN IF NOT EXISTS manager_approver_id UUID REFERENCES public.manager_approvers(id),
ADD COLUMN IF NOT EXISTS subtotal NUMERIC,
ADD COLUMN IF NOT EXISTS tax_amount NUMERIC,
ADD COLUMN IF NOT EXISTS receipt_scanned BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

-- Insert additional expense categories for fleet management (using valid types)
INSERT INTO public.expense_categories (name, type) VALUES
  ('Vehicle Purchase', 'maintenance'),
  ('Tire/Rim Purchase', 'maintenance'),
  ('Fuel', 'maintenance'),
  ('Insurance', 'maintenance'),
  ('Registration & Licensing', 'maintenance'),
  ('Parking & Tolls', 'maintenance'),
  ('Cleaning & Detailing', 'maintenance'),
  ('Towing', 'repair'),
  ('Roadside Assistance', 'repair'),
  ('Parts & Accessories', 'maintenance')
ON CONFLICT (id) DO NOTHING;

-- Insert some common vendors as seed data
INSERT INTO public.vendors (name, category) VALUES
  ('Canadian Tire', 'Parts'),
  ('Costco Tire Centre', 'Tires'),
  ('Jiffy Lube', 'Service'),
  ('Mr. Lube', 'Service'),
  ('Petro-Canada', 'Fuel'),
  ('Shell', 'Fuel'),
  ('NAPA Auto Parts', 'Parts'),
  ('AutoZone', 'Parts'),
  ('Discount Tire', 'Tires'),
  ('Goodyear', 'Tires')
ON CONFLICT (name) DO NOTHING;

-- Create trigger for vendors updated_at
CREATE TRIGGER update_vendors_updated_at
BEFORE UPDATE ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();