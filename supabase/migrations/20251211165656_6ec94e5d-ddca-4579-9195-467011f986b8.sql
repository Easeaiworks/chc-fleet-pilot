-- Create tire_inventory table for tracking spare tires at each branch
CREATE TABLE public.tire_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  brand TEXT NOT NULL,
  measurements TEXT NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('new', 'good', 'fair', 'worn')),
  quantity INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tire_inventory ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view tire inventory" 
ON public.tire_inventory 
FOR SELECT 
USING (true);

CREATE POLICY "Admins and managers can manage tire inventory" 
ON public.tire_inventory 
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

CREATE POLICY "Staff can insert tire inventory" 
ON public.tire_inventory 
FOR INSERT 
WITH CHECK (true);

-- Add notes field to branches for tire-related notes
ALTER TABLE public.branches 
ADD COLUMN IF NOT EXISTS tire_notes TEXT;

-- Create trigger for updated_at
CREATE TRIGGER update_tire_inventory_updated_at
BEFORE UPDATE ON public.tire_inventory
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();