-- Add on_rim and bolt_pattern columns to tire_inventory table
ALTER TABLE public.tire_inventory 
ADD COLUMN on_rim boolean NOT NULL DEFAULT false,
ADD COLUMN bolt_pattern text;