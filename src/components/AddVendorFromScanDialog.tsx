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
import { Building2, Plus } from 'lucide-react';

interface Branch {
  id: string;
  name: string;
}

interface AddVendorFromScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorName: string;
  vendorAddress?: string;
  onVendorCreated: (vendor: { id: string; name: string }) => void;
  onSkip: () => void;
}

const VENDOR_CATEGORIES = [
  'Auto Parts',
  'Fuel Station',
  'Garage/Mechanic',
  'Tire Shop',
  'Car Wash',
  'Insurance',
  'Registration/DMV',
  'Parking',
  'Toll',
  'Other',
];

export function AddVendorFromScanDialog({
  open,
  onOpenChange,
  vendorName,
  vendorAddress,
  onVendorCreated,
  onSkip,
}: AddVendorFromScanDialogProps) {
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    contactName: '',
    services: '',
    notes: '',
    branchId: '',
  });

  useEffect(() => {
    if (open) {
      fetchBranches();
      setFormData({
        name: vendorName || '',
        category: '',
        address: vendorAddress || '',
        phone: '',
        email: '',
        website: '',
        contactName: '',
        services: '',
        notes: '',
        branchId: '',
      });
    }
  }, [open, vendorName, vendorAddress]);

  const fetchBranches = async () => {
    const { data } = await supabase
      .from('branches')
      .select('id, name')
      .order('name');
    if (data) setBranches(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Vendor name is required',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('vendors')
        .insert({
          name: formData.name.trim(),
          category: formData.category || null,
          address: formData.address || null,
          phone: formData.phone || null,
          email: formData.email || null,
          website: formData.website || null,
          contact_name: formData.contactName || null,
          services: formData.services || null,
          notes: formData.notes || null,
          branch_id: formData.branchId || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Vendor Added',
        description: `${formData.name} has been added to your vendor list.`,
      });

      onVendorCreated({ id: data.id, name: data.name });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add vendor',
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
            <Building2 className="h-5 w-5 text-primary" />
            Add New Vendor
          </DialogTitle>
          <DialogDescription>
            We couldn't find "{vendorName}" in your vendor list. Would you like to add it?
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vendor-name">Vendor Name *</Label>
            <Input
              id="vendor-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter vendor name"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendor-category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  {VENDOR_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-branch">Branch/Location</Label>
              <Select
                value={formData.branchId}
                onValueChange={(value) => setFormData({ ...formData, branchId: value })}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor-address">Address</Label>
            <Input
              id="vendor-address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Enter address"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendor-phone">Phone</Label>
              <Input
                id="vendor-phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-email">Email</Label>
              <Input
                id="vendor-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="vendor@example.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendor-website">Website</Label>
              <Input
                id="vendor-website"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="www.vendor.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-contact">Contact Person</Label>
              <Input
                id="vendor-contact"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                placeholder="Contact name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor-services">Services Offered</Label>
            <Input
              id="vendor-services"
              value={formData.services}
              onChange={(e) => setFormData({ ...formData, services: e.target.value })}
              placeholder="e.g., Oil changes, Tire rotation, etc."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor-notes">Notes</Label>
            <Textarea
              id="vendor-notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes about this vendor..."
              rows={2}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={onSkip}>
              Skip for now
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              <Plus className="h-4 w-4" />
              {loading ? 'Adding...' : 'Add Vendor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
