-- Create GPS uploads table to track mileage from GPS files
CREATE TABLE public.gps_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  upload_month DATE NOT NULL,
  kilometers NUMERIC NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.gps_uploads ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Authenticated users can view gps_uploads"
ON public.gps_uploads
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can manage gps_uploads"
ON public.gps_uploads
FOR ALL
USING (true)
WITH CHECK (true);