-- Add subtotal and tax_amount columns to fuel_receipts table for HST tracking
ALTER TABLE public.fuel_receipts 
ADD COLUMN subtotal numeric,
ADD COLUMN tax_amount numeric;