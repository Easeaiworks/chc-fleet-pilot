import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ShoppingCart, CalendarIcon, Car, DollarSign, Upload, X, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Branch {
  id: string;
  name: string;
}

interface Vendor {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

interface AddVehiclePurchaseDialogProps {
  onVehicleAdded: () => void;
  trigger?: React.ReactNode;
}

export function AddVehiclePurchaseDialog({ onVehicleAdded, trigger }: AddVehiclePurchaseDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { toast } = useToast();

  // Vehicle data
  const [vehicleData, setVehicleData] = useState({
    vin: '',
    plate: '',
    make: '',
    model: '',
    year: '',
    branchId: '',
    odometerKm: '0',
    notes: '',
    transponder407: '',
  });

  // Purchase expense data
  const [expenseData, setExpenseData] = useState({
    amount: '',
    subtotal: '',
    taxAmount: '',
    date: new Date(),
    vendorId: '',
    vendorName: '',
    categoryId: '',
    description: '',
    staffName: '',
  });

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  // Auto-calculate total from subtotal and tax
  useEffect(() => {
    const subtotal = parseFloat(expenseData.subtotal) || 0;
    const tax = parseFloat(expenseData.taxAmount) || 0;
    if (subtotal > 0 || tax > 0) {
      setExpenseData(prev => ({ ...prev, amount: (subtotal + tax).toFixed(2) }));
    }
  }, [expenseData.subtotal, expenseData.taxAmount]);

  const fetchData = async () => {
    const [branchesRes, vendorsRes, categoriesRes] = await Promise.all([
      supabase.from('branches').select('id, name').order('name'),
      supabase.from('vendors').select('id, name').order('name'),
      supabase.from('expense_categories').select('id, name, type').eq('type', 'purchase').order('name'),
    ]);
    
    if (branchesRes.data) setBranches(branchesRes.data);
    if (vendorsRes.data) setVendors(vendorsRes.data);
    if (categoriesRes.data) setCategories(categoriesRes.data);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const uploadFiles = async (vehicleId: string, expenseId: string, userId: string) => {
    const uploadPromises = selectedFiles.map(async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${vehicleId}/${expenseId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('vehicle-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('documents').insert({
        vehicle_id: vehicleId,
        expense_id: expenseId,
        file_name: file.name,
        file_path: fileName,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: userId,
      });

      if (dbError) throw dbError;
    });

    await Promise.all(uploadPromises);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: 'Error',
          description: 'You must be logged in to add a vehicle purchase',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // First, create the vehicle
      const { data: vehicleResult, error: vehicleError } = await supabase.from('vehicles').insert({
        vin: vehicleData.vin,
        plate: vehicleData.plate,
        make: vehicleData.make || null,
        model: vehicleData.model || null,
        year: vehicleData.year ? parseInt(vehicleData.year) : null,
        branch_id: vehicleData.branchId || null,
        odometer_km: parseInt(vehicleData.odometerKm) || 0,
        notes: vehicleData.notes || null,
        status: isActive ? 'active' : 'retired',
        transponder_407: vehicleData.transponder407 || null,
      }).select('id').single();

      if (vehicleError) {
        toast({
          title: 'Error adding vehicle',
          description: vehicleError.message,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Then, create the purchase expense linked to the new vehicle
      const { data: expenseResult, error: expenseError } = await supabase.from('expenses').insert({
        vehicle_id: vehicleResult.id,
        category_id: expenseData.categoryId || null,
        amount: parseFloat(expenseData.amount) || 0,
        subtotal: expenseData.subtotal ? parseFloat(expenseData.subtotal) : null,
        tax_amount: expenseData.taxAmount ? parseFloat(expenseData.taxAmount) : null,
        date: format(expenseData.date, 'yyyy-MM-dd'),
        vendor_id: expenseData.vendorId || null,
        vendor_name: expenseData.vendorName || null,
        branch_id: vehicleData.branchId || null,
        description: expenseData.description || `Vehicle Purchase - ${vehicleData.make} ${vehicleData.model} (${vehicleData.plate})`,
        staff_name: expenseData.staffName || null,
        odometer_reading: parseInt(vehicleData.odometerKm) || 0,
        created_by: user.id,
        approval_status: 'pending',
      }).select('id').single();

      if (expenseError) {
        toast({
          title: 'Vehicle added but expense failed',
          description: expenseError.message,
          variant: 'destructive',
        });
      } else {
        // Upload documents if any
        if (selectedFiles.length > 0 && expenseResult) {
          try {
            await uploadFiles(vehicleResult.id, expenseResult.id, user.id);
          } catch (uploadError: any) {
            toast({
              title: 'Documents upload failed',
              description: uploadError.message,
              variant: 'destructive',
            });
          }
        }
        
        toast({
          title: 'Success',
          description: 'Vehicle purchase recorded and added to fleet',
        });
      }

      setOpen(false);
      resetForm();
      onVehicleAdded();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }

    setLoading(false);
  };

  const resetForm = () => {
    setVehicleData({
      vin: '',
      plate: '',
      make: '',
      model: '',
      year: '',
      branchId: '',
      odometerKm: '0',
      notes: '',
      transponder407: '',
    });
    setExpenseData({
      amount: '',
      subtotal: '',
      taxAmount: '',
      date: new Date(),
      vendorId: '',
      vendorName: '',
      categoryId: '',
      description: '',
      staffName: '',
    });
    setSelectedFiles([]);
    setIsActive(true);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            Purchase Vehicle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Record Vehicle Purchase
          </DialogTitle>
          <DialogDescription>
            Enter the purchase details and vehicle information to add it to your fleet
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Purchase/Expense Section */}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <h3 className="font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Purchase Details
            </h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="subtotal">Subtotal</Label>
                <Input
                  id="subtotal"
                  type="number"
                  step="0.01"
                  value={expenseData.subtotal}
                  onChange={(e) => setExpenseData({ ...expenseData, subtotal: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax">Tax Amount</Label>
                <Input
                  id="tax"
                  type="number"
                  step="0.01"
                  value={expenseData.taxAmount}
                  onChange={(e) => setExpenseData({ ...expenseData, taxAmount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="total">Total Amount *</Label>
                <Input
                  id="total"
                  type="number"
                  step="0.01"
                  value={expenseData.amount}
                  onChange={(e) => setExpenseData({ ...expenseData, amount: e.target.value })}
                  placeholder="0.00"
                  required
                  className="font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Purchase Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !expenseData.date && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {expenseData.date ? format(expenseData.date, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={expenseData.date}
                      onSelect={(date) => date && setExpenseData({ ...expenseData, date })}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Purchase Category</Label>
                <Select 
                  value={expenseData.categoryId} 
                  onValueChange={(value) => setExpenseData({ ...expenseData, categoryId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.length === 0 ? (
                      <SelectItem value="none" disabled>No purchase categories found</SelectItem>
                    ) : (
                      categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor/Dealer</Label>
                <Select 
                  value={expenseData.vendorId} 
                  onValueChange={(value) => {
                    const vendor = vendors.find(v => v.id === value);
                    setExpenseData({ 
                      ...expenseData, 
                      vendorId: value,
                      vendorName: vendor?.name || ''
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendorName">Or Enter Vendor Name</Label>
                <Input
                  id="vendorName"
                  value={expenseData.vendorName}
                  onChange={(e) => setExpenseData({ ...expenseData, vendorName: e.target.value, vendorId: '' })}
                  placeholder="Dealer name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="staffName">Purchased By</Label>
              <Input
                id="staffName"
                value={expenseData.staffName}
                onChange={(e) => setExpenseData({ ...expenseData, staffName: e.target.value })}
                placeholder="Staff member name"
              />
            </div>

            {/* Document Upload */}
            <div className="space-y-2">
              <Label>Purchase Documents</Label>
              <div className="border-2 border-dashed rounded-lg p-4 hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  id="purchase-documents"
                  className="hidden"
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={handleFileSelect}
                />
                <label
                  htmlFor="purchase-documents"
                  className="flex flex-col items-center gap-2 cursor-pointer"
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Click to upload receipts, invoices, or documents
                  </span>
                  <span className="text-xs text-muted-foreground">
                    PDF, Images, Word documents
                  </span>
                </label>
              </div>
              
              {selectedFiles.length > 0 && (
                <div className="space-y-2 mt-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Vehicle Section */}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <h3 className="font-semibold flex items-center gap-2">
              <Car className="h-4 w-4 text-primary" />
              Vehicle Details
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vin">VIN *</Label>
                <Input
                  id="vin"
                  value={vehicleData.vin}
                  onChange={(e) => setVehicleData({ ...vehicleData, vin: e.target.value })}
                  required
                  placeholder="1HGBH41JXMN109186"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plate">License Plate *</Label>
                <Input
                  id="plate"
                  value={vehicleData.plate}
                  onChange={(e) => setVehicleData({ ...vehicleData, plate: e.target.value })}
                  required
                  placeholder="ABC-1234"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="make">Make</Label>
                <Input
                  id="make"
                  value={vehicleData.make}
                  onChange={(e) => setVehicleData({ ...vehicleData, make: e.target.value })}
                  placeholder="Ford"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={vehicleData.model}
                  onChange={(e) => setVehicleData({ ...vehicleData, model: e.target.value })}
                  placeholder="F-150"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  value={vehicleData.year}
                  onChange={(e) => setVehicleData({ ...vehicleData, year: e.target.value })}
                  placeholder="2024"
                  min="1900"
                  max={new Date().getFullYear() + 1}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="branch">Branch/Location</Label>
                <Select 
                  value={vehicleData.branchId} 
                  onValueChange={(value) => setVehicleData({ ...vehicleData, branchId: value })}
                >
                  <SelectTrigger>
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
              <div className="space-y-2">
                <Label htmlFor="odometer">Initial Odometer (km)</Label>
                <Input
                  id="odometer"
                  type="number"
                  value={vehicleData.odometerKm}
                  onChange={(e) => setVehicleData({ ...vehicleData, odometerKm: e.target.value })}
                  min="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transponder407">407 Transponder</Label>
              <Input
                id="transponder407"
                value={vehicleData.transponder407}
                onChange={(e) => setVehicleData({ ...vehicleData, transponder407: e.target.value.slice(0, 10).toUpperCase() })}
                placeholder="ABC123"
                maxLength={10}
                className="font-mono"
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg bg-background">
              <div className="space-y-0.5">
                <Label htmlFor="active-toggle">Vehicle Status</Label>
                <p className="text-sm text-muted-foreground">
                  {isActive ? 'Active - Ready for use' : 'Inactive - Not in use'}
                </p>
              </div>
              <Switch
                id="active-toggle"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={vehicleData.notes}
                onChange={(e) => setVehicleData({ ...vehicleData, notes: e.target.value })}
                placeholder="Additional notes about this vehicle purchase..."
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              {loading ? 'Recording...' : 'Record Purchase & Add Vehicle'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
