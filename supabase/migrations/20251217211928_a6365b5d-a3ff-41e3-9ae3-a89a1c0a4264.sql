-- Create vehicle inspections table
CREATE TABLE public.vehicle_inspections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id),
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  inspection_month DATE NOT NULL DEFAULT date_trunc('month', CURRENT_DATE),
  kilometers INTEGER,
  
  -- Pass/Fail fields (true = pass, false = fail)
  brakes_pass BOOLEAN NOT NULL DEFAULT true,
  brakes_notes TEXT,
  engine_pass BOOLEAN NOT NULL DEFAULT true,
  engine_notes TEXT,
  transmission_pass BOOLEAN NOT NULL DEFAULT true,
  transmission_notes TEXT,
  tires_pass BOOLEAN NOT NULL DEFAULT true,
  tires_notes TEXT,
  headlights_pass BOOLEAN NOT NULL DEFAULT true,
  headlights_notes TEXT,
  signal_lights_pass BOOLEAN NOT NULL DEFAULT true,
  signal_lights_notes TEXT,
  oil_level_pass BOOLEAN NOT NULL DEFAULT true,
  oil_level_notes TEXT,
  windshield_fluid_pass BOOLEAN NOT NULL DEFAULT true,
  windshield_fluid_notes TEXT,
  wipers_pass BOOLEAN NOT NULL DEFAULT true,
  wipers_notes TEXT,
  
  completed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vehicle_inspections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Approved users can view inspections"
ON public.vehicle_inspections
FOR SELECT
USING (is_user_approved(auth.uid()));

CREATE POLICY "Approved staff can create inspections"
ON public.vehicle_inspections
FOR INSERT
WITH CHECK (is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can update inspections"
ON public.vehicle_inspections
FOR UPDATE
USING (is_user_approved(auth.uid()) AND (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid() AND user_roles.role = ANY (ARRAY['admin'::text, 'manager'::text])
)));

CREATE POLICY "Approved admins can delete inspections"
ON public.vehicle_inspections
FOR DELETE
USING (is_user_approved(auth.uid()) AND is_admin(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_vehicle_inspections_updated_at
BEFORE UPDATE ON public.vehicle_inspections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();