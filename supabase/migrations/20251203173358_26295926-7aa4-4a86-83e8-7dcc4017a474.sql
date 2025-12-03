-- Add is_blocked column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN is_blocked boolean NOT NULL DEFAULT false,
ADD COLUMN blocked_by uuid REFERENCES public.profiles(id),
ADD COLUMN blocked_at timestamp with time zone,
ADD COLUMN block_reason text;