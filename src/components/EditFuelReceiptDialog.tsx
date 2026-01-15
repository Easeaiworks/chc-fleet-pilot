import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Fuel } from 'lucide-react';
import { emitExpensesChanged } from '@/utils/expensesEvents';

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

interface Vendor {
  id: string;
  name: string;
}

interface FuelReceipt {
  id: string;
  vehicle_id: string;
  branch_id: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  staff_name: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  amount: number;
  date: string;
  description: string | null;
}

interface EditFuelReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fuelReceipt: FuelReceipt | null;
  onSaved?: () => void;
}

export function EditFuelReceiptDialog({
  open,
  onOpenChange,
  fuelReceipt,
  onSaved,
}: EditFuelReceiptDialogProps) {
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    vehicleId: '',
    branchId: '',
    vendorId: '',
    vendorName: '',
    staffName: '',
    subtotal: '',
    taxAmount: '',
    amount: '',
    date: '',
    description: '',
  });

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  useEffect(() => {
    if (fuelReceipt) {
      setFormData({
        vehicleId: fuelReceipt.vehicle_id || '',
        branchId: fuelReceipt.branch_id || '',
        vendorId: fuelReceipt.vendor_id || '',
        vendorName: fuelReceipt.vendor_name || '',
        staffName: fuelReceipt.staff_name || '',
        subtotal: fuelReceipt.subtotal?.toString() || '',
        taxAmount: fuelReceipt.tax_amount?.toString() || '',
        amount: fuelReceipt.amount?.toString() || '',
        date: fuelReceipt.date || '',
        description: fuelReceipt.description || '',
      });
    }
  }, [fuelReceipt]);

  const fetchData = async () => {
    const [branchesRes, vehiclesRes, vendorsRes] = await Promise.all([
      supabase.from('branches').select('id, name').order('name'),
      supabase.from('vehicles').select('id, plate, make, model').order('plate'),
      supabase.from('vendors').select('id, name').order('name'),
    ]);

    if (branchesRes.data) setBranches(branchesRes.data);
    if (vehiclesRes.data) setVehicles(vehiclesRes.data);
    if (vendorsRes.data) setVendors(vendorsRes.data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fuelReceipt) return;

    if (!formData.vehicleId) {
      toast({
        title: 'Error',
        description: 'Please select a vehicle',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.branchId) {
      toast({
        title: 'Error',
        description: 'Please select a branch',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast({
        title: 'Error',
        description: 'Please enter a valid amount',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('fuel_receipts')
        .update({
          vehicle_id: formData.vehicleId,
          branch_id: formData.branchId || null,
          vendor_id: formData.vendorId || null,
          vendor_name: formData.vendorName || null,
          staff_name: formData.staffName || null,
          subtotal: formData.subtotal ? parseFloat(formData.subtotal) : null,
          tax_amount: formData.taxAmount ? parseFloat(formData.taxAmount) : null,
          amount: parseFloat(formData.amount),
          date: formData.date,
          description: formData.description || null,
        })
        .eq('id', fuelReceipt.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Fuel receipt has been updated',
      });

      onOpenChange(false);
      emitExpensesChanged();
      onSaved?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fuel className="h-5 w-5" />
            Edit Fuel Receipt
          </DialogTitle>
          <DialogDescription>
            Update the fuel receipt details below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-fuel-vehicle">Vehicle *</Label>
              <Select
                value={formData.vehicleId}
                onValueChange={(value) => setFormData({ ...formData, vehicleId: value })}
              >
                <SelectTrigger id="edit-fuel-vehicle">
                  <SelectValue placeholder="Select a vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.make} {vehicle.model} ({vehicle.plate})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-fuel-branch">Branch *</Label>
              <Select
                value={formData.branchId}
                onValueChange={(value) => setFormData({ ...formData, branchId: value })}
              >
                <SelectTrigger id="edit-fuel-branch">
                  <SelectValue placeholder="Select a branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-fuel-vendor">Vendor</Label>
              <Select
                value={formData.vendorId}
                onValueChange={(value) => {
                  const vendor = vendors.find(v => v.id === value);
                  setFormData({ 
                    ...formData, 
                    vendorId: value,
                    vendorName: vendor?.name || formData.vendorName
                  });
                }}
              >
                <SelectTrigger id="edit-fuel-vendor">
                  <SelectValue placeholder="Select a vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-fuel-vendor-name">Vendor Name</Label>
              <Input
                id="edit-fuel-vendor-name"
                value={formData.vendorName}
                onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                placeholder="Or enter vendor name manually"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-fuel-staff">Staff Name</Label>
            <Input
              id="edit-fuel-staff"
              value={formData.staffName}
              onChange={(e) => setFormData({ ...formData, staffName: e.target.value })}
              placeholder="Staff member name"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-fuel-subtotal">Subtotal ($)</Label>
              <Input
                id="edit-fuel-subtotal"
                type="number"
                step="0.01"
                value={formData.subtotal}
                onChange={(e) => setFormData({ ...formData, subtotal: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-fuel-tax">HST ($)</Label>
              <Input
                id="edit-fuel-tax"
                type="number"
                step="0.01"
                value={formData.taxAmount}
                onChange={(e) => setFormData({ ...formData, taxAmount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-fuel-amount">Total ($) *</Label>
              <Input
                id="edit-fuel-amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-fuel-date">Date *</Label>
            <Input
              id="edit-fuel-date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-fuel-description">Description</Label>
            <Textarea
              id="edit-fuel-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
