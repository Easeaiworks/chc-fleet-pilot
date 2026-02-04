import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CalendarIcon, AlertTriangle, RefreshCw, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Category {
  id: string;
  name: string;
  type: string;
}

interface Branch {
  id: string;
  name: string;
}

interface Vehicle {
  id: string;
  plate: string;
  make: string | null;
  model: string | null;
}

interface Expense {
  id: string;
  amount: number;
  subtotal: number | null;
  tax_amount: number | null;
  date: string;
  description: string | null;
  vehicle_id: string;
  category_id: string | null;
  branch_id: string | null;
  rejection_reason: string | null;
  vendor_name: string | null;
  staff_name: string | null;
  odometer_reading: number | null;
}

interface EditExpenseDialogProps {
  expense: Expense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExpenseUpdated: () => void;
}

export function EditExpenseDialog({ expense, open, onOpenChange, onExpenseUpdated }: EditExpenseDialogProps) {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [canScrollMore, setCanScrollMore] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const checkScrollability = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      const hasMoreContent = container.scrollHeight > container.clientHeight;
      const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 20;
      setCanScrollMore(hasMoreContent && !isAtBottom);
    }
  }, []);

  const [formData, setFormData] = useState({
    amount: '',
    subtotal: '',
    taxAmount: '',
    date: new Date(),
    description: '',
    vehicleId: '',
    categoryId: '',
    branchId: '',
    vendorName: '',
    staffName: '',
    odometerReading: '',
  });

  useEffect(() => {
    // Check scrollability when dialog opens or form data changes
    const timer = setTimeout(checkScrollability, 100);
    return () => clearTimeout(timer);
  }, [open, formData, checkScrollability]);

  useEffect(() => {
    if (open && expense) {
      fetchData();
      setFormData({
        amount: expense.amount?.toString() || '',
        subtotal: expense.subtotal?.toString() || '',
        taxAmount: expense.tax_amount?.toString() || '',
        date: expense.date ? new Date(expense.date) : new Date(),
        description: expense.description || '',
        vehicleId: expense.vehicle_id || '',
        categoryId: expense.category_id || '',
        branchId: expense.branch_id || '',
        vendorName: expense.vendor_name || '',
        staffName: expense.staff_name || '',
        odometerReading: expense.odometer_reading?.toString() || '',
      });
    }
  }, [open, expense]);

  // Auto-calculate total from subtotal and tax
  useEffect(() => {
    const subtotal = parseFloat(formData.subtotal) || 0;
    const tax = parseFloat(formData.taxAmount) || 0;
    if (subtotal > 0 || tax > 0) {
      setFormData(prev => ({ ...prev, amount: (subtotal + tax).toFixed(2) }));
    }
  }, [formData.subtotal, formData.taxAmount]);

  const fetchData = async () => {
    const [categoriesRes, branchesRes, vehiclesRes] = await Promise.all([
      supabase.from('expense_categories').select('id, name, type').order('type').order('name'),
      supabase.from('branches').select('id, name').order('name'),
      supabase.from('vehicles').select('id, plate, make, model').order('plate'),
    ]);
    
    if (categoriesRes.data) setCategories(categoriesRes.data);
    if (branchesRes.data) setBranches(branchesRes.data);
    if (vehiclesRes.data) setVehicles(vehiclesRes.data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expense) return;
    
    if (!formData.branchId) {
      toast({
        title: 'Error',
        description: 'Please select a branch location',
        variant: 'destructive',
      });
      return;
    }
    
    setLoading(true);

    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          amount: parseFloat(formData.amount) || 0,
          subtotal: formData.subtotal ? parseFloat(formData.subtotal) : null,
          tax_amount: formData.taxAmount ? parseFloat(formData.taxAmount) : null,
          date: format(formData.date, 'yyyy-MM-dd'),
          description: formData.description || null,
          vehicle_id: formData.vehicleId,
          category_id: formData.categoryId || null,
          branch_id: formData.branchId,
          vendor_name: formData.vendorName || null,
          staff_name: formData.staffName || null,
          odometer_reading: formData.odometerReading ? parseInt(formData.odometerReading) : null,
          // Reset to pending for re-approval
          approval_status: 'pending',
          approved_by: null,
          approved_at: null,
          rejection_reason: null,
          modified_at: new Date().toISOString(),
        })
        .eq('id', expense.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Expense updated and re-submitted for approval',
      });

      onOpenChange(false);
      onExpenseUpdated();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update expense',
        variant: 'destructive',
      });
    }

    setLoading(false);
  };

  if (!expense) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Edit & Re-submit Expense
          </DialogTitle>
          <DialogDescription>
            Make corrections and re-submit this expense for approval
          </DialogDescription>
        </DialogHeader>

        {expense.rejection_reason && (
          <Alert variant="destructive" className="bg-destructive/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Rejection Reason:</strong> {expense.rejection_reason}
            </AlertDescription>
          </Alert>
        )}

        <div className="relative flex-1 min-h-0 overflow-hidden">
          <div 
            ref={scrollContainerRef}
            onScroll={checkScrollability}
            className="h-[55vh] pr-4 overflow-y-auto"
          >
            <form onSubmit={handleSubmit} className="space-y-4 pb-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vehicle">Vehicle *</Label>
              <Select
                value={formData.vehicleId}
                onValueChange={(value) => setFormData({ ...formData, vehicleId: value })}
              >
                <SelectTrigger id="vehicle">
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.make} {v.model} ({v.plate})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.categoryId}
                onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch">Location/Branch *</Label>
              <Select
                value={formData.branchId}
                onValueChange={(value) => setFormData({ ...formData, branchId: value })}
              >
                <SelectTrigger id="branch">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subtotal">Subtotal</Label>
              <Input
                id="subtotal"
                type="number"
                step="0.01"
                value={formData.subtotal}
                onChange={(e) => setFormData({ ...formData, subtotal: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax">Tax Amount</Label>
              <Input
                id="tax"
                type="number"
                step="0.01"
                value={formData.taxAmount}
                onChange={(e) => setFormData({ ...formData, taxAmount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Total Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                required
                className="font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !formData.date && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.date ? format(formData.date, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.date}
                    onSelect={(date) => date && setFormData({ ...formData, date })}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="odometer">Odometer Reading</Label>
              <Input
                id="odometer"
                type="number"
                value={formData.odometerReading}
                onChange={(e) => setFormData({ ...formData, odometerReading: e.target.value })}
                placeholder="km"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor Name</Label>
              <Input
                id="vendor"
                value={formData.vendorName}
                onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                placeholder="Vendor or shop name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff">Staff Name</Label>
              <Input
                id="staff"
                value={formData.staffName}
                onChange={(e) => setFormData({ ...formData, staffName: e.target.value })}
                placeholder="Who made the expense"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Description of the expense..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              {loading ? 'Submitting...' : 'Re-submit for Approval'}
            </Button>
          </div>
            </form>
          </div>
          {/* Scroll indicator with text hint */}
          {canScrollMore && (
            <div className="absolute bottom-0 left-0 right-4 flex flex-col items-center pointer-events-none">
              <div className="h-12 w-full bg-gradient-to-t from-background via-background/80 to-transparent" />
              <div className="absolute bottom-2 flex items-center gap-1 text-xs text-muted-foreground animate-bounce">
                <ChevronDown className="h-3 w-3" />
                <span>Scroll for more fields</span>
                <ChevronDown className="h-3 w-3" />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
