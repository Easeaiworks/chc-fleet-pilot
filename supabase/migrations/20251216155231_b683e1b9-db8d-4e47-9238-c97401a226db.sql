-- Add tire_type column to tire_inventory table
ALTER TABLE public.tire_inventory 
ADD COLUMN tire_type text NOT NULL DEFAULT 'all_season';