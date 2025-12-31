-- Create fuel_receipts table
CREATE TABLE public.fuel_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id),
  amount NUMERIC NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor_name TEXT,
  vendor_id UUID REFERENCES public.vendors(id),
  staff_name TEXT,
  description TEXT,
  receipt_scanned BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.fuel_receipts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Approved users can view fuel receipts"
ON public.fuel_receipts
FOR SELECT
USING (is_user_approved(auth.uid()));

CREATE POLICY "Approved staff can create fuel receipts"
ON public.fuel_receipts
FOR INSERT
WITH CHECK (is_user_approved(auth.uid()) AND (created_by = auth.uid()));

CREATE POLICY "Approved staff can update own pending fuel receipts"
ON public.fuel_receipts
FOR UPDATE
USING (is_user_approved(auth.uid()) AND (created_by = auth.uid()));

CREATE POLICY "Approved admins and managers can update any fuel receipt"
ON public.fuel_receipts
FOR UPDATE
USING (is_user_approved(auth.uid()) AND is_admin_or_manager(auth.uid()))
WITH CHECK (is_user_approved(auth.uid()) AND is_admin_or_manager(auth.uid()));

CREATE POLICY "Approved admins can delete fuel receipts"
ON public.fuel_receipts
FOR DELETE
USING (is_user_approved(auth.uid()) AND is_admin(auth.uid()));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_fuel_receipts_updated_at
BEFORE UPDATE ON public.fuel_receipts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();