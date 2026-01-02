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
import { Fuel, Upload, X, Loader2 } from 'lucide-react';
import { ReceiptVerificationDialog, ScannedReceiptData } from './ReceiptVerificationDialog';
import { AddVendorFromScanDialog } from './AddVendorFromScanDialog';

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

interface FuelReceiptDialogProps {
  trigger?: React.ReactNode;
  onReceiptAdded?: () => void;
}

export function FuelReceiptDialog({ trigger, onReceiptAdded }: FuelReceiptDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanningFile, setScanningFile] = useState<File | null>(null);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [scannedData, setScannedData] = useState<ScannedReceiptData | null>(null);
  const [addVendorOpen, setAddVendorOpen] = useState(false);
  const [pendingVendorData, setPendingVendorData] = useState<{ name: string; address?: string } | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    vehicleId: '',
    branchId: '',
    vendorId: '',
    vendorName: '',
    staffName: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
  });

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    const [branchesRes, vehiclesRes, vendorsRes, staffRes] = await Promise.all([
      supabase.from('branches').select('id, name').order('name'),
      supabase.from('vehicles').select('id, plate, make, model').order('plate'),
      supabase.from('vendors').select('*').order('name'),
      supabase.from('profiles').select('id, email, full_name').eq('is_approved', true).eq('id', user?.id || '').single()
    ]);

    if (branchesRes.data) setBranches(branchesRes.data);
    if (vehiclesRes.data) setVehicles(vehiclesRes.data);
    if (vendorsRes.data) setVendors(vendorsRes.data);

    // Pre-select current user as staff member
    if (staffRes.data) {
      setFormData(prev => ({ 
        ...prev, 
        staffName: staffRes.data.full_name || staffRes.data.email 
      }));
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
    setScannedData(null);
    setVerificationOpen(true);
    
    try {
      const textContent = await extractTextFromFile(file);
      
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
        setScannedData({
          vendor_name: data.vendor_name,
          vendor_address: data.vendor_address,
          subtotal: data.subtotal,
          tax_amount: data.tax_amount,
          total: data.total,
          date: data.date,
          description: data.description,
        });
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
    setFormData(prev => ({
      ...prev,
      vendorName: data.vendor_name || prev.vendorName,
      amount: data.total?.toString() || prev.amount,
      date: data.date || prev.date,
      description: data.description || prev.description,
    }));

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

  const resetForm = () => {
    setFormData({
      vehicleId: '',
      branchId: '',
      vendorId: '',
      vendorName: '',
      staffName: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
    });
    setSelectedFiles([]);
  };

  const uploadFiles = async (fuelReceiptId: string, vehicleId: string) => {
    const uploadPromises = selectedFiles.map(async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `fuel/${fuelReceiptId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('vehicle-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('documents').insert({
        vehicle_id: vehicleId,
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
      const { data: fuelReceipt, error } = await supabase
        .from('fuel_receipts')
        .insert({
          vehicle_id: formData.vehicleId,
          branch_id: formData.branchId || null,
          vendor_id: formData.vendorId || null,
          vendor_name: formData.vendorName || null,
          staff_name: formData.staffName || null,
          amount: parseFloat(formData.amount),
          date: formData.date,
          description: formData.description || null,
          created_by: user?.id,
          receipt_scanned: selectedFiles.length > 0,
        })
        .select()
        .single();

      if (error) throw error;

      if (selectedFiles.length > 0 && fuelReceipt) {
        await uploadFiles(fuelReceipt.id, formData.vehicleId);
      }

      toast({
        title: 'Success',
        description: 'Fuel receipt has been recorded',
      });

      setOpen(false);
      resetForm();
      onReceiptAdded?.();
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
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" size="sm" className="gap-2">
              <Fuel className="h-4 w-4" />
              <span className="hidden sm:inline">Fuel Receipt</span>
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Fuel className="h-5 w-5" />
              Add Fuel Receipt
            </DialogTitle>
            <DialogDescription>
              Upload a fuel receipt or enter the details manually.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* File Upload */}
            <div className="space-y-2">
              <Label>Receipt Upload</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                <Input
                  type="file"
                  accept="image/*,.pdf,.csv,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="fuel-file-upload"
                  multiple
                />
                <label htmlFor="fuel-file-upload" className="cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload receipts
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Images, PDF, CSV supported • AI will extract data
                  </p>
                </label>
              </div>
              
              {selectedFiles.length > 0 && (
                <div className="space-y-2 mt-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-muted rounded-lg p-2">
                      <span className="text-sm truncate flex-1">{file.name}</span>
                      <div className="flex items-center gap-2">
                        {scanning && scanningFile === file && (
                          <Loader2 className="h-4 w-4 animate-spin" />
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

            {/* Vehicle Selection */}
            <div className="space-y-2">
              <Label htmlFor="fuel-vehicle">Vehicle *</Label>
              <Select
                value={formData.vehicleId}
                onValueChange={(value) => setFormData({ ...formData, vehicleId: value })}
              >
                <SelectTrigger id="fuel-vehicle">
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

            {/* Branch Selection */}
            <div className="space-y-2">
              <Label htmlFor="fuel-branch">Branch *</Label>
              <Select
                value={formData.branchId}
                onValueChange={(value) => setFormData({ ...formData, branchId: value })}
              >
                <SelectTrigger id="fuel-branch">
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

            {/* Vendor Selection */}
            <div className="space-y-2">
              <Label htmlFor="fuel-vendor">Gas Station / Vendor</Label>
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
                <SelectTrigger id="fuel-vendor">
                  <SelectValue placeholder="Select or type vendor name" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!formData.vendorId && (
                <Input
                  placeholder="Or enter vendor name manually"
                  value={formData.vendorName}
                  onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                />
              )}
            </div>

            {/* Staff Name */}
            <div className="space-y-2">
              <Label htmlFor="fuel-staff">Staff Name</Label>
              <Input
                id="fuel-staff"
                value={formData.staffName}
                onChange={(e) => setFormData({ ...formData, staffName: e.target.value })}
                placeholder="Who purchased the fuel?"
              />
            </div>

            {/* Amount & Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fuel-amount">Amount ($) *</Label>
                <Input
                  id="fuel-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  className="font-semibold"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fuel-date">Date *</Label>
                <Input
                  id="fuel-date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="fuel-description">Notes</Label>
              <Textarea
                id="fuel-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Additional notes (optional)"
                rows={2}
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save Fuel Receipt
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Receipt Verification Dialog */}
      <ReceiptVerificationDialog
        open={verificationOpen}
        onOpenChange={setVerificationOpen}
        scannedData={scannedData}
        isScanning={scanning}
        imageFile={scanningFile}
        onConfirm={handleVerificationConfirm}
        onCancel={handleVerificationCancel}
      />

      {/* Add Vendor Dialog */}
      <AddVendorFromScanDialog
        open={addVendorOpen}
        onOpenChange={setAddVendorOpen}
        vendorName={pendingVendorData?.name || ''}
        vendorAddress={pendingVendorData?.address}
        onVendorCreated={handleVendorCreated}
        onSkip={handleVendorSkip}
      />
    </>
  );
}
