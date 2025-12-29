import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Store, Plus, Pencil, Trash2, MapPin, Phone, Mail, Globe, User } from 'lucide-react';

interface Branch {
  id: string;
  name: string;
}

interface Vendor {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  contact_name: string | null;
  services: string | null;
  notes: string | null;
  branch_id: string | null;
  branches?: { name: string } | null;
}

const VENDOR_CATEGORIES = [
  'Parts',
  'Service',
  'Tires',
  'Fuel',
  'Body Shop',
  'Glass',
  'Electrical',
  'HVAC',
  'Transmission',
  'Dealership',
  'Other'
];

export function VendorManager() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [open, setOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { isAdminOrManager } = useUserRole();

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
    fetchVendors();
    fetchBranches();
  }, []);

  const fetchVendors = async () => {
    const { data } = await supabase
      .from('vendors')
      .select(`
        *,
        branches (name)
      `)
      .order('name');
    if (data) setVendors(data);
  };

  const fetchBranches = async () => {
    const { data } = await supabase
      .from('branches')
      .select('id, name')
      .order('name');
    if (data) setBranches(data);
  };

  const openAddDialog = () => {
    setEditingVendor(null);
    setFormData({
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
    setOpen(true);
  };

  const openEditDialog = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      category: vendor.category || '',
      address: vendor.address || '',
      phone: vendor.phone || '',
      email: vendor.email || '',
      website: vendor.website || '',
      contactName: vendor.contact_name || '',
      services: vendor.services || '',
      notes: vendor.notes || '',
      branchId: vendor.branch_id || '',
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const vendorData = {
      name: formData.name,
      category: formData.category || null,
      address: formData.address || null,
      phone: formData.phone || null,
      email: formData.email || null,
      website: formData.website || null,
      contact_name: formData.contactName || null,
      services: formData.services || null,
      notes: formData.notes || null,
      branch_id: formData.branchId || null,
    };

    if (editingVendor) {
      const { error } = await supabase
        .from('vendors')
        .update(vendorData)
        .eq('id', editingVendor.id);

      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success',
          description: 'Vendor updated successfully',
        });
        setOpen(false);
        setEditingVendor(null);
        fetchVendors();
      }
    } else {
      const { error } = await supabase.from('vendors').insert(vendorData);

      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success',
          description: 'Vendor added successfully',
        });
        setOpen(false);
        fetchVendors();
      }
    }

    setLoading(false);
  };

  const handleDelete = async (vendor: Vendor) => {
    if (!confirm(`Are you sure you want to delete "${vendor.name}"? This cannot be undone.`)) {
      return;
    }

    const { error } = await supabase
      .from('vendors')
      .delete()
      .eq('id', vendor.id);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Vendor deleted successfully',
      });
      fetchVendors();
    }
  };

  const filteredVendors = vendors.filter(vendor =>
    vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.services?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              Vendor Management
            </CardTitle>
            <CardDescription>Manage vendors and service providers</CardDescription>
          </div>
          {isAdminOrManager && (
            <Button size="sm" className="gap-2" onClick={openAddDialog}>
              <Plus className="h-4 w-4" />
              Add Vendor
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <Input
          placeholder="Search vendors by name, category, or services..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />

        {filteredVendors.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {searchTerm ? 'No vendors match your search' : 'No vendors added yet'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVendors.map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{vendor.name}</p>
                        {vendor.address && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {vendor.address}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {vendor.category && (
                        <Badge variant="outline">{vendor.category}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-muted-foreground max-w-48 truncate">
                        {vendor.services || '-'}
                      </p>
                    </TableCell>
                    <TableCell>
                      {vendor.branches?.name ? (
                        <Badge variant="secondary">{vendor.branches.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">All branches</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        {vendor.contact_name && (
                          <p className="flex items-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            {vendor.contact_name}
                          </p>
                        )}
                        {vendor.phone && (
                          <p className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {vendor.phone}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {isAdminOrManager && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(vendor)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(vendor)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVendor ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle>
            <DialogDescription>
              {editingVendor ? 'Update the vendor details below.' : 'Enter the details for the new vendor.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name & Category */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Vendor Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Canadian Tire"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    {VENDOR_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Branch & Services */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
              <Label htmlFor="branch">Applicable Branch</Label>
              <Select 
                value={formData.branchId || "all"} 
                onValueChange={(value) => setFormData({ ...formData, branchId: value === "all" ? "" : value })}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="All branches" />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
              <div className="space-y-2">
                <Label htmlFor="services">Services Offered</Label>
                <Input
                  id="services"
                  value={formData.services}
                  onChange={(e) => setFormData({ ...formData, services: e.target.value })}
                  placeholder="e.g., Oil changes, Brakes, Tires"
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="e.g., 123 Main St, Hamilton, ON"
              />
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactName">Contact Person</Label>
                <Input
                  id="contactName"
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  placeholder="e.g., John Smith"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g., (905) 555-1234"
                />
              </div>
            </div>

            {/* Email & Website */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g., service@vendor.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="e.g., www.vendor.com"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about this vendor..."
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : editingVendor ? 'Update Vendor' : 'Add Vendor'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
