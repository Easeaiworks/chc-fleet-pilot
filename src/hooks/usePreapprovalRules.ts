import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PreapprovalRule {
  id: string;
  branch_id: string | null;
  category_id: string;
  max_amount: number;
  is_active: boolean;
}

export function usePreapprovalRules() {
  const [rules, setRules] = useState<PreapprovalRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const { data, error } = await supabase
        .from('expense_preapproval_rules')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      setRules(data || []);
    } catch (error) {
      console.error('Error fetching preapproval rules:', error);
      setRules([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check if an expense should be auto-approved based on pre-approval rules
   * @param categoryId - The expense category ID
   * @param amount - The expense amount
   * @param branchId - The branch ID (optional)
   * @returns true if expense should be auto-approved
   */
  const shouldAutoApprove = (
    categoryId: string | null | undefined, 
    amount: number, 
    branchId?: string | null
  ): boolean => {
    if (!categoryId) return false;

    // Find matching rules - prefer branch-specific rules over global ones
    const matchingRules = rules.filter(rule => 
      rule.category_id === categoryId && 
      rule.is_active &&
      (rule.branch_id === null || rule.branch_id === branchId)
    );

    if (matchingRules.length === 0) return false;

    // Prefer branch-specific rule if available
    const branchSpecificRule = matchingRules.find(r => r.branch_id === branchId);
    const rule = branchSpecificRule || matchingRules.find(r => r.branch_id === null);

    if (!rule) return false;

    // Auto-approve if amount is at or below the threshold
    return amount <= rule.max_amount;
  };

  return {
    rules,
    loading,
    shouldAutoApprove,
    refetch: fetchRules,
  };
}
