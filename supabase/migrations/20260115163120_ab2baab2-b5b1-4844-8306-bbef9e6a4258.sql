-- Create pre-approval rules table
CREATE TABLE public.expense_preapproval_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.expense_categories(id) ON DELETE CASCADE,
  max_amount NUMERIC NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(branch_id, category_id)
);

-- Enable RLS
ALTER TABLE public.expense_preapproval_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Approved users can view preapproval rules"
ON public.expense_preapproval_rules
FOR SELECT
USING (is_user_approved(auth.uid()));

CREATE POLICY "Admins can manage preapproval rules"
ON public.expense_preapproval_rules
FOR ALL
USING (is_user_approved(auth.uid()) AND is_admin(auth.uid()))
WITH CHECK (is_user_approved(auth.uid()) AND is_admin(auth.uid()));

CREATE POLICY "Require authentication for expense_preapproval_rules"
ON public.expense_preapproval_rules
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Add updated_at trigger
CREATE TRIGGER update_expense_preapproval_rules_updated_at
BEFORE UPDATE ON public.expense_preapproval_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial rule: Oil Change under $100 auto-approved for all branches
INSERT INTO public.expense_preapproval_rules (branch_id, category_id, max_amount, is_active)
VALUES (NULL, 'b84b1d4e-69bc-440f-945b-6e971ff31886', 100.00, true);