-- Add default_branch_id column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN default_branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.default_branch_id IS 'Default branch for the user when submitting expenses';