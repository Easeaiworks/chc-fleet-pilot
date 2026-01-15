import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Fuel, Eye, Pencil, Trash2, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
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
} from '@/components/ui/alert-dialog';
import { EditFuelReceiptDialog } from '@/components/EditFuelReceiptDialog';
import { EXPENSES_CHANGED_EVENT } from '@/utils/expensesEvents';
import { useUserRole } from '@/hooks/useUserRole';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
  receipt_scanned: boolean | null;
  created_at: string;
  vehicle: Vehicle | null;
  branch: Branch | null;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
};

export function FuelReceiptHistory() {
  const [receipts, setReceipts] = useState<FuelReceipt[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<FuelReceipt | null>(null);
  const [editReceipt, setEditReceipt] = useState<FuelReceipt | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [deleteReceipt, setDeleteReceipt] = useState<FuelReceipt | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  const { toast } = useToast();
  const { isAdmin } = useUserRole();

  useEffect(() => {
    fetchBranches();
    fetchVehicles();
    fetchReceipts();

    const handleExpensesChanged = () => {
      fetchReceipts();
    };

    window.addEventListener(EXPENSES_CHANGED_EVENT, handleExpensesChanged);
    return () => {
      window.removeEventListener(EXPENSES_CHANGED_EVENT, handleExpensesChanged);
    };
  }, []);

  useEffect(() => {
    fetchReceipts();
  }, [selectedBranch, selectedVehicle]);

  const fetchBranches = async () => {
    const { data } = await supabase.from('branches').select('id, name').order('name');
    if (data) setBranches(data);
  };

  const fetchVehicles = async () => {
    const { data } = await supabase.from('vehicles').select('id, plate, make, model').order('plate');
    if (data) setVehicles(data);
  };

  const fetchReceipts = async () => {
    setLoading(true);

    let query = supabase
      .from('fuel_receipts')
      .select(`
        id,
        vehicle_id,
        branch_id,
        vendor_id,
        vendor_name,
        staff_name,
        subtotal,
        tax_amount,
        amount,
        date,
        description,
        receipt_scanned,
        created_at,
        vehicles (id, plate, make, model),
        branches (id, name)
      `)
      .order('date', { ascending: false })
      .limit(100);

    if (selectedBranch !== 'all') {
      query = query.eq('branch_id', selectedBranch);
    }

    if (selectedVehicle !== 'all') {
      query = query.eq('vehicle_id', selectedVehicle);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching fuel receipts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load fuel receipt history',
        variant: 'destructive',
      });
    } else if (data) {
      const mapped = data.map((receipt: any) => ({
        id: receipt.id,
        vehicle_id: receipt.vehicle_id,
        branch_id: receipt.branch_id,
        vendor_id: receipt.vendor_id,
        vendor_name: receipt.vendor_name,
        staff_name: receipt.staff_name,
        subtotal: receipt.subtotal,
        tax_amount: receipt.tax_amount,
        amount: receipt.amount,
        date: receipt.date,
        description: receipt.description,
        receipt_scanned: receipt.receipt_scanned,
        created_at: receipt.created_at,
        vehicle: receipt.vehicles,
        branch: receipt.branches,
      }));
      setReceipts(mapped);
    }

    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteReceipt) return;

    try {
      const { error } = await supabase
        .from('fuel_receipts')
        .delete()
        .eq('id', deleteReceipt.id);

      if (error) throw error;

      toast({
        title: 'Deleted',
        description: 'Fuel receipt has been deleted',
      });

      setShowDeleteDialog(false);
      setDeleteReceipt(null);
      fetchReceipts();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Fuel className="h-5 w-5" />
              Fuel Receipt History
            </CardTitle>
            <CardDescription>
              View and manage submitted fuel receipts
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Branch</label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger>
                    <SelectValue placeholder="All branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Vehicle</label>
                <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                  <SelectTrigger>
                    <SelectValue placeholder="All vehicles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Vehicles</SelectItem>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.make} {vehicle.model} ({vehicle.plate})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading fuel receipts...</p>
          </div>
        ) : receipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Fuel className="h-12 w-12 mb-2 opacity-50" />
            <p>No fuel receipts found</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map((receipt) => (
                  <TableRow key={receipt.id}>
                    <TableCell>{format(new Date(receipt.date), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      {receipt.vehicle
                        ? `${receipt.vehicle.make || ''} ${receipt.vehicle.model || ''} (${receipt.vehicle.plate})`
                        : 'N/A'}
                    </TableCell>
                    <TableCell>{receipt.branch?.name || 'N/A'}</TableCell>
                    <TableCell>{receipt.vendor_name || '-'}</TableCell>
                    <TableCell>{receipt.staff_name || '-'}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(receipt.amount)}</TableCell>
                    <TableCell>
                      {receipt.receipt_scanned ? (
                        <Badge className="bg-green-500/20 text-green-700 border-green-500/30">Scanned</Badge>
                      ) : (
                        <Badge variant="secondary">No</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedReceipt(receipt);
                            setDetailsOpen(true);
                          }}
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditReceipt(receipt);
                            setShowEditDialog(true);
                          }}
                          title="Edit fuel receipt"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDeleteReceipt(receipt);
                              setShowDeleteDialog(true);
                            }}
                            title="Delete fuel receipt"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Fuel Receipt Details</DialogTitle>
            </DialogHeader>
            {selectedReceipt && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-medium">{format(new Date(selectedReceipt.date), 'MMMM d, yyyy')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount</p>
                    <p className="font-medium text-lg">{formatCurrency(selectedReceipt.amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Vehicle</p>
                    <p className="font-medium">
                      {selectedReceipt.vehicle
                        ? `${selectedReceipt.vehicle.make} ${selectedReceipt.vehicle.model} (${selectedReceipt.vehicle.plate})`
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Branch</p>
                    <p className="font-medium">{selectedReceipt.branch?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Vendor</p>
                    <p className="font-medium">{selectedReceipt.vendor_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Staff</p>
                    <p className="font-medium">{selectedReceipt.staff_name || '-'}</p>
                  </div>
                  {selectedReceipt.subtotal && (
                    <div>
                      <p className="text-sm text-muted-foreground">Subtotal</p>
                      <p className="font-medium">{formatCurrency(selectedReceipt.subtotal)}</p>
                    </div>
                  )}
                  {selectedReceipt.tax_amount && (
                    <div>
                      <p className="text-sm text-muted-foreground">HST</p>
                      <p className="font-medium">{formatCurrency(selectedReceipt.tax_amount)}</p>
                    </div>
                  )}
                </div>
                {selectedReceipt.description && (
                  <div>
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="font-medium">{selectedReceipt.description}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <EditFuelReceiptDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          fuelReceipt={editReceipt}
          onSaved={fetchReceipts}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Fuel Receipt</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this fuel receipt? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
