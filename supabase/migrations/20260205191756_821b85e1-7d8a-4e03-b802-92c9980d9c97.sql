-- Add general_notes column to vehicle_inspections table
ALTER TABLE public.vehicle_inspections 
ADD COLUMN general_notes TEXT NULL;