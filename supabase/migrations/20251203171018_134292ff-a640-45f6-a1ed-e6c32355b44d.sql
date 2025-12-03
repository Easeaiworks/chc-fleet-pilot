-- Add approval status to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;

-- Add approved_by and approved_at columns
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;

-- Update existing users to be approved (so current users aren't locked out)
UPDATE public.profiles SET is_approved = true WHERE is_approved = false;