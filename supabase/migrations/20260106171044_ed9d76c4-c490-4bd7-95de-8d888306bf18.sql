-- Add soft delete columns to expenses table
ALTER TABLE public.expenses 
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN deleted_by UUID DEFAULT NULL;

-- Add index for faster queries on non-deleted expenses
CREATE INDEX idx_expenses_deleted_at ON public.expenses(deleted_at);

-- Add comment for documentation
COMMENT ON COLUMN public.expenses.deleted_at IS 'Timestamp when expense was soft deleted';
COMMENT ON COLUMN public.expenses.deleted_by IS 'User ID who deleted the expense';