-- Add detailed tire info columns to vehicles table for both sets
ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS summer_tire_brand text,
ADD COLUMN IF NOT EXISTS summer_tire_measurements text,
ADD COLUMN IF NOT EXISTS summer_tire_condition text,
ADD COLUMN IF NOT EXISTS winter_tire_brand text,
ADD COLUMN IF NOT EXISTS winter_tire_measurements text,
ADD COLUMN IF NOT EXISTS winter_tire_condition text;

-- Create tire claim requests table for approval workflow
CREATE TABLE public.tire_claim_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_item_id UUID NOT NULL REFERENCES public.tire_inventory(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id),
  requested_by UUID REFERENCES auth.users(id),
  tire_type text NOT NULL CHECK (tire_type IN ('winter', 'summer')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason text,
  notes text,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on tire_claim_requests
ALTER TABLE public.tire_claim_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for tire_claim_requests
CREATE POLICY "Authenticated users can view tire claim requests"
ON public.tire_claim_requests
FOR SELECT
USING (true);

CREATE POLICY "Staff can create tire claim requests"
ON public.tire_claim_requests
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can manage tire claim requests"
ON public.tire_claim_requests
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Add updated_at trigger
CREATE TRIGGER update_tire_claim_requests_updated_at
BEFORE UPDATE ON public.tire_claim_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();