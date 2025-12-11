-- Create tire_changes table to track tire swap activities
CREATE TABLE public.tire_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  tire_type TEXT NOT NULL CHECK (tire_type IN ('winter', 'summer', 'all_season')),
  current_tire_type TEXT CHECK (current_tire_type IN ('winter', 'summer', 'all_season')),
  change_date DATE NOT NULL DEFAULT CURRENT_DATE,
  summer_tire_location TEXT,
  winter_tire_location TEXT,
  notes TEXT,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tire_changes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view tire changes" 
ON public.tire_changes 
FOR SELECT 
USING (true);

CREATE POLICY "Admins and managers can manage tire changes" 
ON public.tire_changes 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_roles.user_id = auth.uid() 
  AND user_roles.role IN ('admin', 'manager')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_roles.user_id = auth.uid() 
  AND user_roles.role IN ('admin', 'manager')
));

CREATE POLICY "Staff can insert tire changes" 
ON public.tire_changes 
FOR INSERT 
WITH CHECK (true);

-- Add tire tracking fields to vehicles table
ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS current_tire_type TEXT DEFAULT 'summer' CHECK (current_tire_type IN ('winter', 'summer', 'all_season')),
ADD COLUMN IF NOT EXISTS summer_tire_location TEXT,
ADD COLUMN IF NOT EXISTS winter_tire_location TEXT,
ADD COLUMN IF NOT EXISTS tire_notes TEXT;

-- Create trigger for updated_at
CREATE TRIGGER update_tire_changes_updated_at
BEFORE UPDATE ON public.tire_changes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();