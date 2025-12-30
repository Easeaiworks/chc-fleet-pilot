-- Drop the existing check constraint
ALTER TABLE public.expense_categories DROP CONSTRAINT IF EXISTS expense_categories_type_check;

-- Add a new check constraint that includes 'purchase'
ALTER TABLE public.expense_categories ADD CONSTRAINT expense_categories_type_check 
  CHECK (type IN ('maintenance', 'repair', 'purchase'));

-- Add Purchase category
INSERT INTO expense_categories (name, type) VALUES ('Purchase', 'purchase');