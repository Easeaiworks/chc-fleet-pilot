import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Receipt, Upload, X, Loader2 } from 'lucide-react';
import { ReceiptVerificationDialog, ScannedReceiptData } from './ReceiptVerificationDialog';
import { AddVendorFromScanDialog } from './AddVendorFromScanDialog';

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

interface Vendor {
  id: string;
  name: string;
  category: string | null;
}

interface ManagerApprover {
  id: string;
  name: string;
}

interface StaffMember {
  id: string;
  email: string;
  full_name: string | null;
}

interface AddExpenseDialogProps {
  vehicleId: string;
  onExpenseAdded: () => void;
  trigger?: React.ReactNode;
}

export function AddExpenseDialog({ vehicleId, onExpenseAdded, trigger }: AddExpenseDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanningFile, setScanningFile] = useState<File | null>(null);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [scannedData, setScannedData] = useState<ScannedReceiptData | null>(null);
  const [addVendorOpen, setAddVendorOpen] = useState(false);
  const [pendingVendorData, setPendingVendorData] = useState<{ name: string; address?: string } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [managers, setManagers] = useState<ManagerApprover[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdminOrManager } = useUserRole();

  const [formData, setFormData] = useState({
    vehicleId: vehicleId || '',
    categoryId: '',
    branchId: '',
    vendorId: '',
    vendorName: '',
    managerId: '',
    staffName: '',
    subtotal: '',
    taxAmount: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    odometerReading: '',
  });

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  useEffect(() => {
    // Auto-calculate total from subtotal + tax
    const subtotal = parseFloat(formData.subtotal) || 0;
    const tax = parseFloat(formData.taxAmount) || 0;
    if (subtotal > 0 || tax > 0) {
      setFormData(prev => ({ ...prev, amount: (subtotal + tax).toFixed(2) }));
    }
  }, [formData.subtotal, formData.taxAmount]);

  const fetchData = async () => {
    const [categoriesRes, branchesRes, vehiclesRes, vendorsRes, managersRes, staffRes] = await Promise.all([
      supabase.from('expense_categories').select('*').order('name'),
      supabase.from('branches').select('id, name').order('name'),
      supabase.from('vehicles').select('id, plate, make, model').order('plate'),
      supabase.from('vendors').select('*').order('name'),
      supabase.from('manager_approvers').select('*').eq('is_active', true).order('name'),
      supabase.from('profiles').select('id, email, full_name').eq('is_approved', true).order('full_name')
    ]);

    if (categoriesRes.data) setCategories(categoriesRes.data);
    if (branchesRes.data) setBranches(branchesRes.data);
    if (vehiclesRes.data) setVehicles(vehiclesRes.data);
    if (vendorsRes.data) setVendors(vendorsRes.data);
    if (managersRes.data) setManagers(managersRes.data);
    if (staffRes.data) setStaffMembers(staffRes.data);

    // Pre-select vehicle if provided
    if (vehicleId) {
      setFormData(prev => ({ ...prev, vehicleId }));
    }

    // Pre-select current user as staff member
    if (user && staffRes.data) {
      const currentUser = staffRes.data.find(s => s.id === user.id);
      if (currentUser) {
        setFormData(prev => ({ 
          ...prev, 
          staffName: currentUser.full_name || currentUser.email 
        }));
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...files]);
      
      // Auto-scan the first scannable file
      const scannableFile = files.find(f => canScanFile(f));
      if (scannableFile) {
        await scanReceiptWithVerification(scannableFile);
      }
    }
  };

  const canScanFile = (file: File): boolean => {
    const scannableTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'text/plain', 'text/csv', 'application/csv',
    ];
    return scannableTypes.includes(file.type) || 
           file.name.endsWith('.csv') || 
           file.name.endsWith('.txt');
  };

  const removeFile = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const extractTextFromFile = async (file: File): Promise<string | null> => {
    // For text-based files, read as text
    if (file.type.startsWith('text/') || file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
      });
    }
    return null;
  };

  const scanReceiptWithVerification = async (file: File) => {
    setScanning(true);
    setScanningFile(file);
    setVerificationOpen(true);
    setScannedData(null);
    
    try {
      // For text files, extract text first
      const textContent = await extractTextFromFile(file);
      
      // Convert file to base64 for non-text files
      let base64 = '';
      if (!textContent) {
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      const { data, error } = await supabase.functions.invoke('scan-receipt', {
        body: { 
          fileBase64: base64, 
          mimeType: file.type,
          fileName: file.name,
          textContent 
        }
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        toast({
          title: 'Scan Notice',
          description: data.error,
          variant: 'destructive',
        });
        setScannedData({});
      } else if (data) {
        setScannedData(data);
      } else {
        setScannedData({});
      }
    } catch (error: any) {
      console.error('Scan error:', error);
      toast({
        title: 'Scan Failed',
        description: error.message || 'Failed to scan document. Please enter data manually.',
        variant: 'destructive',
      });
      setScannedData({});
    }
    setScanning(false);
  };

  const handleVerificationConfirm = (data: ScannedReceiptData) => {
    // Apply verified data to form
    setFormData(prev => ({
      ...prev,
      vendorName: data.vendor_name || prev.vendorName,
      subtotal: data.subtotal?.toString() || prev.subtotal,
      taxAmount: data.tax_amount?.toString() || prev.taxAmount,
      amount: data.total?.toString() || prev.amount,
      date: data.date || prev.date,
      description: data.description || prev.description,
    }));

    // Try to match vendor
    let vendorMatched = false;
    if (data.vendor_name) {
      const matchedVendor = vendors.find(v => 
        v.name.toLowerCase().includes(data.vendor_name!.toLowerCase()) ||
        data.vendor_name!.toLowerCase().includes(v.name.toLowerCase())
      );
      if (matchedVendor) {
        setFormData(prev => ({ ...prev, vendorId: matchedVendor.id }));
        vendorMatched = true;
      }
    }

    setVerificationOpen(false);

    // If vendor not found, offer to add new vendor
    if (data.vendor_name && !vendorMatched) {
      setPendingVendorData({
        name: data.vendor_name,
        address: data.vendor_address,
      });
      setAddVendorOpen(true);
    } else {
      toast({
        title: 'Data Applied',
        description: 'Receipt data has been applied to the form. Please review and complete any remaining fields.',
      });
    }
  };

  const handleVendorCreated = (vendor: { id: string; name: string }) => {
    // Add the new vendor to the local list and select it
    setVendors(prev => [...prev, { id: vendor.id, name: vendor.name, category: null }]);
    setFormData(prev => ({ ...prev, vendorId: vendor.id, vendorName: vendor.name }));
    setPendingVendorData(null);
    toast({
      title: 'Data Applied',
      description: 'Receipt data and new vendor have been applied to the form.',
    });
  };

  const handleVendorSkip = () => {
    setAddVendorOpen(false);
    setPendingVendorData(null);
    toast({
      title: 'Data Applied',
      description: 'Receipt data has been applied to the form. Please review and complete any remaining fields.',
    });
  };

  const handleVerificationCancel = () => {
    setVerificationOpen(false);
    setScannedData(null);
  };

  const uploadFiles = async (expenseId: string, targetVehicleId: string) => {
    const uploadPromises = selectedFiles.map(async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${expenseId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('vehicle-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('documents').insert({
        vehicle_id: targetVehicleId,
        expense_id: expenseId,
        file_name: file.name,
        file_path: fileName,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: user?.id,
      });

      if (dbError) throw dbError;
    });

    await Promise.all(uploadPromises);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.vehicleId) {
      toast({
        title: 'Error',
        description: 'Please select a vehicle',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
        .insert({
          vehicle_id: formData.vehicleId,
          category_id: formData.categoryId || null,
          branch_id: formData.branchId || null,
          vendor_id: formData.vendorId || null,
          vendor_name: formData.vendorName || null,
          manager_approver_id: formData.managerId || null,
          staff_name: formData.staffName || null,
          subtotal: formData.subtotal ? parseFloat(formData.subtotal) : null,
          tax_amount: formData.taxAmount ? parseFloat(formData.taxAmount) : null,
          amount: parseFloat(formData.amount),
          date: formData.date,
          description: formData.description || null,
          odometer_reading: formData.odometerReading ? parseInt(formData.odometerReading) : null,
          created_by: user?.id,
          receipt_scanned: selectedFiles.length > 0,
        })
        .select()
        .single();

      if (expenseError) throw expenseError;

      if (selectedFiles.length > 0 && expense) {
        await uploadFiles(expense.id, formData.vehicleId);
      }

      toast({
        title: 'Success',
        description: isAdminOrManager 
          ? 'Expense added successfully' 
          : 'Expense submitted for approval. A manager will review it shortly.',
      });

      setOpen(false);
      setFormData({
        vehicleId: vehicleId || '',
        categoryId: '',
        branchId: '',
        vendorId: '',
        vendorName: '',
        managerId: '',
        staffName: '',
        subtotal: '',
        taxAmount: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        odometerReading: '',
      });
      setSelectedFiles([]);
      onExpenseAdded();
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2">
            <Receipt className="h-4 w-4" />
            Add Expense
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
          <DialogDescription>
            Record a new expense with receipt scanning
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Receipt Upload with Scan */}
          <div className="space-y-2">
            <Label>Upload Receipt or Document</Label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary transition-colors">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                multiple
                accept="image/*,.pdf,.csv,.txt,text/plain,text/csv,application/pdf"
                onChange={handleFileSelect}
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to upload receipts (images, PDF, CSV, TXT)
                </p>
              </label>
            </div>

            {selectedFiles.length > 0 && (
              <div className="space-y-2 mt-4">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm truncate flex-1">{file.name}</span>
                    <div className="flex gap-2">
                      {canScanFile(file) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => scanReceiptWithVerification(file)}
                          disabled={scanning}
                        >
                          {scanning ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          <span className="ml-1">Re-scan</span>
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Vehicle Selection (if not pre-selected) */}
          {!vehicleId && (
            <div className="space-y-2">
              <Label htmlFor="vehicle">Vehicle *</Label>
              <Select value={formData.vehicleId} onValueChange={(value) => setFormData({ ...formData, vehicleId: value })} required>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.make} {vehicle.model} ({vehicle.plate})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Expense Type *</Label>
            <Select value={formData.categoryId} onValueChange={(value) => setFormData({ ...formData, categoryId: value })} required>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select expense type" />
              </SelectTrigger>
              <SelectContent className="bg-background max-h-60">
                <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">Maintenance</div>
                {categories.filter(c => c.type === 'maintenance').map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
                <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground border-t mt-2 pt-2">Repairs</div>
                {categories.filter(c => c.type === 'repair').map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
                <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground border-t mt-2 pt-2">Vehicle Purchase</div>
                {categories.filter(c => c.type === 'purchase').map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vendor */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor</Label>
              <Select value={formData.vendorId} onValueChange={(value) => {
                const vendor = vendors.find(v => v.id === value);
                setFormData({ ...formData, vendorId: value, vendorName: vendor?.name || '' });
              }}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent className="bg-background max-h-60">
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendorName">Or Enter Vendor Name</Label>
              <Input
                id="vendorName"
                value={formData.vendorName}
                onChange={(e) => setFormData({ ...formData, vendorName: e.target.value, vendorId: '' })}
                placeholder="Enter vendor name"
              />
            </div>
          </div>

          {/* Branch & Staff */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="branch">Location/Branch</Label>
              <Select value={formData.branchId} onValueChange={(value) => setFormData({ ...formData, branchId: value })}>
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
            <div className="space-y-2">
              <Label htmlFor="staffName">Staff Member</Label>
              <Select 
                value={formData.staffName} 
                onValueChange={(value) => setFormData({ ...formData, staffName: value })}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent className="bg-background max-h-60">
                  {staffMembers.map((staff) => (
                    <SelectItem key={staff.id} value={staff.full_name || staff.email}>
                      {staff.full_name || staff.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Manager Approval */}
          <div className="space-y-2">
            <Label htmlFor="manager">Approved By (Manager)</Label>
            <Select value={formData.managerId} onValueChange={(value) => setFormData({ ...formData, managerId: value })}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select manager" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                {managers.map((manager) => (
                  <SelectItem key={manager.id} value={manager.id}>
                    {manager.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subtotal">Subtotal ($)</Label>
              <Input
                id="subtotal"
                type="number"
                step="0.01"
                min="0"
                value={formData.subtotal}
                onChange={(e) => setFormData({ ...formData, subtotal: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax">Tax ($)</Label>
              <Input
                id="tax"
                type="number"
                step="0.01"
                min="0"
                value={formData.taxAmount}
                onChange={(e) => setFormData({ ...formData, taxAmount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Total ($) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
                placeholder="0.00"
                className="font-semibold"
              />
            </div>
          </div>

          {/* Date & Odometer */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="odometer">Odometer Reading (km)</Label>
              <Input
                id="odometer"
                type="number"
                min="0"
                value={formData.odometerReading}
                onChange={(e) => setFormData({ ...formData, odometerReading: e.target.value })}
                placeholder="Current odometer"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Details about this expense..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Expense'}
            </Button>
          </div>
        </form>
      </DialogContent>

      <ReceiptVerificationDialog
        open={verificationOpen}
        onOpenChange={setVerificationOpen}
        scannedData={scannedData}
        isScanning={scanning}
        imageFile={scanningFile}
        onConfirm={handleVerificationConfirm}
        onCancel={handleVerificationCancel}
      />

      <AddVendorFromScanDialog
        open={addVendorOpen}
        onOpenChange={setAddVendorOpen}
        vendorName={pendingVendorData?.name || ''}
        vendorAddress={pendingVendorData?.address}
        onVendorCreated={handleVendorCreated}
        onSkip={handleVendorSkip}
      />
    </Dialog>
  );
}
