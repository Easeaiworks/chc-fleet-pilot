-- Make vehicle_id nullable to support unmatched GPS entries
ALTER TABLE public.gps_uploads ALTER COLUMN vehicle_id DROP NOT NULL;

-- Add column to store the original vehicle name from the GPS file
ALTER TABLE public.gps_uploads ADD COLUMN gps_vehicle_name text;

-- Add index for better querying by gps_vehicle_name
CREATE INDEX idx_gps_uploads_vehicle_name ON public.gps_uploads(gps_vehicle_name);