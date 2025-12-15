-- Add 407 transponder field to vehicles table
ALTER TABLE public.vehicles 
ADD COLUMN transponder_407 varchar(10) DEFAULT NULL;