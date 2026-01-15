import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Pencil, Trash2, Plus, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface PreapprovalRule {
  id: string;
  branch_id: string | null;
  category_id: string;
  max_amount: number;
  is_active: boolean;
  created_at: string;
  category_name?: string;
  branch_name?: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

interface Branch {
  id: string;
  name: string;
}

export function PreapprovalRulesManager() {
  const [rules, setRules] = useState<PreapprovalRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PreapprovalRule | null>(null);
  const [formData, setFormData] = useState({
    branchId: '',
    categoryId: '',
    maxAmount: '',
    isActive: true,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rulesRes, categoriesRes, branchesRes] = await Promise.all([
        supabase
          .from('expense_preapproval_rules')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('expense_categories').select('*').order('name'),
        supabase.from('branches').select('id, name').order('name'),
      ]);

      if (rulesRes.error) throw rulesRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      if (branchesRes.error) throw branchesRes.error;

      setCategories(categoriesRes.data || []);
      setBranches(branchesRes.data || []);

      // Enrich rules with category and branch names
      const enrichedRules = (rulesRes.data || []).map(rule => ({
        ...rule,
        category_name: categoriesRes.data?.find(c => c.id === rule.category_id)?.name || 'Unknown',
        branch_name: rule.branch_id 
          ? branchesRes.data?.find(b => b.id === rule.branch_id)?.name || 'Unknown'
          : 'All Branches',
      }));

      setRules(enrichedRules);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load pre-approval rules',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (rule?: PreapprovalRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        branchId: rule.branch_id || '',
        categoryId: rule.category_id,
        maxAmount: rule.max_amount.toString(),
        isActive: rule.is_active,
      });
    } else {
      setEditingRule(null);
      setFormData({
        branchId: '',
        categoryId: '',
        maxAmount: '',
        isActive: true,
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.categoryId || !formData.maxAmount) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    const amount = parseFloat(formData.maxAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Error',
        description: 'Please enter a valid amount greater than 0',
        variant: 'destructive',
      });
      return;
    }

    try {
      const payload = {
        branch_id: formData.branchId || null,
        category_id: formData.categoryId,
        max_amount: amount,
        is_active: formData.isActive,
      };

      if (editingRule) {
        const { error } = await supabase
          .from('expense_preapproval_rules')
          .update(payload)
          .eq('id', editingRule.id);
        if (error) throw error;
        toast({ title: 'Success', description: 'Pre-approval rule updated' });
      } else {
        const { error } = await supabase
          .from('expense_preapproval_rules')
          .insert(payload);
        if (error) throw error;
        toast({ title: 'Success', description: 'Pre-approval rule created' });
      }

      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save rule',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (ruleId: string) => {
    try {
      const { error } = await supabase
        .from('expense_preapproval_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;

      toast({ title: 'Success', description: 'Pre-approval rule deleted' });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete rule',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (rule: PreapprovalRule) => {
    try {
      const { error } = await supabase
        .from('expense_preapproval_rules')
        .update({ is_active: !rule.is_active })
        .eq('id', rule.id);

      if (error) throw error;

      toast({ 
        title: 'Success', 
        description: `Rule ${rule.is_active ? 'disabled' : 'enabled'}` 
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update rule',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Loading pre-approval rules...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Pre-Approval Rules
            </CardTitle>
            <CardDescription>
              Configure expenses that automatically bypass approval based on category and amount thresholds
            </CardDescription>
          </div>
          <Button onClick={() => handleOpenDialog()} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Rule
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {rules.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No pre-approval rules configured. Add a rule to allow certain expenses to skip the approval queue.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Max Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.category_name}</TableCell>
                  <TableCell>
                    {rule.branch_id ? (
                      rule.branch_name
                    ) : (
                      <Badge variant="secondary">All Branches</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono">${rule.max_amount.toFixed(2)}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={() => handleToggleActive(rule)}
                      />
                      <span className={rule.is_active ? 'text-green-600' : 'text-muted-foreground'}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(rule)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Pre-Approval Rule</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this pre-approval rule for "{rule.category_name}"? 
                              Expenses in this category will require manual approval.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(rule.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Edit Pre-Approval Rule' : 'Add Pre-Approval Rule'}
            </DialogTitle>
            <DialogDescription>
              Expenses matching this rule will be automatically approved without manager review.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category">Expense Category *</Label>
              <Select
                value={formData.categoryId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, categoryId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name} ({cat.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch">Branch (optional)</Label>
              <Select
                value={formData.branchId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, branchId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Branches</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Leave empty to apply rule to all branches
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxAmount">Maximum Amount ($) *</Label>
              <Input
                id="maxAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g., 100.00"
                value={formData.maxAmount}
                onChange={(e) => setFormData(prev => ({ ...prev, maxAmount: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Expenses at or below this amount will be auto-approved
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
              />
              <Label htmlFor="isActive">Rule is active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingRule ? 'Update Rule' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
