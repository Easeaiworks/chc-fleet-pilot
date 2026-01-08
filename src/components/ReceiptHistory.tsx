import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileDown, Receipt, Filter, Eye, Download, FileText, Image, ExternalLink, Pencil, Trash2 } from 'lucide-react';
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
import { EditExpenseDialog } from '@/components/EditExpenseDialog';
import { EXPENSES_CHANGED_EVENT } from '@/utils/expensesEvents';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';

interface ExpenseDocument {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
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
  branch_id: string | null;
}

interface ExpenseCategory {
  id: string;
  name: string;
  type: string;
}

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
}

interface ReceiptExpense {
  id: string;
  date: string;
  amount: number;
  subtotal: number | null;
  tax_amount: number | null;
  description: string | null;
  vendor_name: string | null;
  receipt_scanned: boolean | null;
  approval_status: string | null;
  created_at: string;
  vehicle_id: string;
  category_id: string | null;
  rejection_reason: string | null;
  staff_name: string | null;
  odometer_reading: number | null;
  vehicle: {
    id: string;
    plate: string;
    make: string | null;
    model: string | null;
  } | null;
  branch: {
    id: string;
    name: string;
  } | null;
  category: {
    id: string;
    name: string;
    type: string;
  } | null;
  created_by_profile: {
    id: string;
    email: string;
    full_name: string | null;
  } | null;
}

export function ReceiptHistory() {
  const [receipts, setReceipts] = useState<ReceiptExpense[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedReceiptFilter, setSelectedReceiptFilter] = useState<string>('all');

  const [selectedExpense, setSelectedExpense] = useState<ReceiptExpense | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [expenseDocuments, setExpenseDocuments] = useState<ExpenseDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [editExpense, setEditExpense] = useState<ReceiptExpense | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [deleteExpense, setDeleteExpense] = useState<ReceiptExpense | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { toast } = useToast();
  const { isAdmin } = useUserRole();
  const { user } = useAuth();

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchReceipts();
  }, [selectedBranch, selectedVehicle, selectedCategory, selectedUser, selectedReceiptFilter]);

  useEffect(() => {
    const onExpensesChanged = () => {
      fetchReceipts();
    };

    window.addEventListener(EXPENSES_CHANGED_EVENT, onExpensesChanged);
    return () => window.removeEventListener(EXPENSES_CHANGED_EVENT, onExpensesChanged);
  }, [selectedBranch, selectedVehicle, selectedCategory, selectedUser, selectedReceiptFilter]);

  useEffect(() => {
    if (selectedBranch === 'all') {
      setFilteredVehicles(vehicles);
    } else {
      setFilteredVehicles(vehicles.filter(v => v.branch_id === selectedBranch));
    }
    if (selectedVehicle !== 'all') {
      const vehicleStillValid = selectedBranch === 'all' || 
        vehicles.find(v => v.id === selectedVehicle && v.branch_id === selectedBranch);
      if (!vehicleStillValid) {
        setSelectedVehicle('all');
      }
    }
  }, [selectedBranch, vehicles, selectedVehicle]);

  const fetchFilters = async () => {
    const [branchesRes, vehiclesRes, categoriesRes, profilesRes] = await Promise.all([
      supabase.from('branches').select('id, name').order('name'),
      supabase.from('vehicles').select('id, plate, make, model, branch_id').order('plate'),
      supabase.from('expense_categories').select('id, name, type').order('name'),
      supabase.from('profiles').select('id, email, full_name').order('email')
    ]);

    if (branchesRes.data) setBranches(branchesRes.data);
    if (vehiclesRes.data) {
      setVehicles(vehiclesRes.data);
      setFilteredVehicles(vehiclesRes.data);
    }
    if (categoriesRes.data) setCategories(categoriesRes.data);
    if (profilesRes.data) setUsers(profilesRes.data);
  };

  const fetchReceipts = async () => {
    setLoading(true);

    let query = supabase
      .from('expenses')
      .select(`
        id,
        date,
        amount,
        subtotal,
        tax_amount,
        description,
        vendor_name,
        receipt_scanned,
        approval_status,
        created_at,
        created_by,
        vehicle_id,
        branch_id,
        category_id,
        rejection_reason,
        staff_name,
        odometer_reading,
        vehicles (id, plate, make, model),
        branches (id, name),
        expense_categories (id, name, type),
        profiles:created_by (id, email, full_name)
      `)
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .limit(100);

    if (selectedBranch !== 'all') {
      query = query.eq('branch_id', selectedBranch);
    }

    if (selectedVehicle !== 'all') {
      query = query.eq('vehicle_id', selectedVehicle);
    }

    if (selectedCategory !== 'all') {
      query = query.eq('category_id', selectedCategory);
    }

    if (selectedUser !== 'all') {
      query = query.eq('created_by', selectedUser);
    }

    if (selectedReceiptFilter === 'scanned') {
      query = query.eq('receipt_scanned', true);
    } else if (selectedReceiptFilter === 'not_scanned') {
      query = query.or('receipt_scanned.is.null,receipt_scanned.eq.false');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching receipts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load receipt history',
        variant: 'destructive',
      });
    } else if (data) {
      const mapped = data.map((exp: any) => ({
        id: exp.id,
        date: exp.date,
        amount: exp.amount,
        subtotal: exp.subtotal,
        tax_amount: exp.tax_amount,
        description: exp.description,
        vendor_name: exp.vendor_name,
        receipt_scanned: exp.receipt_scanned,
        approval_status: exp.approval_status,
        created_at: exp.created_at,
        vehicle_id: exp.vehicle_id,
        category_id: exp.category_id,
        rejection_reason: exp.rejection_reason,
        staff_name: exp.staff_name,
        odometer_reading: exp.odometer_reading,
        vehicle: exp.vehicles,
        branch: exp.branches,
        category: exp.expense_categories,
        created_by_profile: exp.profiles,
      }));
      setReceipts(mapped);
    }

    setLoading(false);
  };

  const fetchExpenseDocuments = async (expenseId: string) => {
    setLoadingDocuments(true);
    setExpenseDocuments([]);

    const { data, error } = await supabase
      .from('documents')
      .select('id, file_name, file_path, file_type, file_size')
      .eq('expense_id', expenseId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching documents:', error);
    } else if (data) {
      setExpenseDocuments(data);
    }

    setLoadingDocuments(false);
  };

  const getDocumentUrl = async (filePath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('vehicle-documents')
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (error) {
      console.error('Error getting signed URL:', error);
      toast({
        title: 'Error',
        description: 'Failed to get document URL',
        variant: 'destructive',
      });
      return null;
    }

    return data.signedUrl;
  };

  const handleViewDocument = async (doc: ExpenseDocument) => {
    const url = await getDocumentUrl(doc.file_path);
    if (url) {
      window.open(url, '_blank');
    }
  };

  const handleDownloadDocument = async (doc: ExpenseDocument) => {
    const url = await getDocumentUrl(doc.file_path);
    if (url) {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    }
  };

  const getFileIcon = (fileType: string | null) => {
    if (fileType?.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const openExpenseDetails = async (expense: ReceiptExpense) => {
    setSelectedExpense(expense);
    setDetailsOpen(true);
    await fetchExpenseDocuments(expense.id);
  };

  const handleDeleteExpense = async () => {
    if (!deleteExpense || !user) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
        })
        .eq('id', deleteExpense.id);

      if (error) throw error;

      toast({
        title: 'Expense Deleted',
        description: 'The expense has been successfully deleted.',
      });
      
      setShowDeleteDialog(false);
      setDeleteExpense(null);
      fetchReceipts();
      
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent(EXPENSES_CHANGED_EVENT));
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete expense',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500/20 text-green-700 border-green-500/30">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/20 text-red-700 border-red-500/30">Rejected</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30">Pending</Badge>;
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  const exportToCSV = () => {
    if (receipts.length === 0) {
      toast({
        title: 'No Data',
        description: 'No receipts to export',
        variant: 'destructive',
      });
      return;
    }

    const headers = ['Date', 'Vehicle', 'Branch', 'Category', 'Vendor', 'Subtotal', 'Tax', 'Total', 'Receipt Scanned', 'Status', 'Submitted By', 'Description'];
    const rows = receipts.map(r => [
      r.date,
      r.vehicle ? `${r.vehicle.make || ''} ${r.vehicle.model || ''} (${r.vehicle.plate})` : 'N/A',
      r.branch?.name || 'N/A',
      r.category?.name || 'Uncategorized',
      r.vendor_name || 'N/A',
      r.subtotal?.toFixed(2) || '',
      r.tax_amount?.toFixed(2) || '',
      r.amount.toFixed(2),
      r.receipt_scanned ? 'Yes' : 'No',
      r.approval_status || 'draft',
      r.created_by_profile?.full_name || r.created_by_profile?.email || 'N/A',
      r.description || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    toast({
      title: 'Success',
      description: 'Receipt history exported as CSV',
    });
  };

  const summaryStats = {
    total: receipts.length,
    scanned: receipts.filter(r => r.receipt_scanned).length,
    totalAmount: receipts.reduce((sum, r) => sum + r.amount, 0),
    approved: receipts.filter(r => r.approval_status === 'approved').length,
    pending: receipts.filter(r => r.approval_status === 'pending').length,
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Filters:</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Select value={selectedBranch} onValueChange={setSelectedBranch}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Branch" />
          </SelectTrigger>
          <SelectContent className="bg-background">
            <SelectItem value="all">All Branches</SelectItem>
            {branches.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Vehicle" />
          </SelectTrigger>
          <SelectContent className="bg-background">
            <SelectItem value="all">All Vehicles</SelectItem>
            {filteredVehicles.map((vehicle) => (
              <SelectItem key={vehicle.id} value={vehicle.id}>
                {vehicle.make} {vehicle.model} ({vehicle.plate})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Expense Type" />
          </SelectTrigger>
          <SelectContent className="bg-background">
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedUser} onValueChange={setSelectedUser}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Submitted By" />
          </SelectTrigger>
          <SelectContent className="bg-background">
            <SelectItem value="all">All Users</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.full_name || user.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedReceiptFilter} onValueChange={setSelectedReceiptFilter}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Receipt Status" />
          </SelectTrigger>
          <SelectContent className="bg-background">
            <SelectItem value="all">All Receipts</SelectItem>
            <SelectItem value="scanned">Scanned Only</SelectItem>
            <SelectItem value="not_scanned">Not Scanned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground">Total Records</p>
          <p className="text-xl font-bold">{summaryStats.total}</p>
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground">Receipts Scanned</p>
          <p className="text-xl font-bold">{summaryStats.scanned}</p>
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground">Total Amount</p>
          <p className="text-xl font-bold">{formatCurrency(summaryStats.totalAmount)}</p>
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground">Approved</p>
          <p className="text-xl font-bold text-green-600">{summaryStats.approved}</p>
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground">Pending</p>
          <p className="text-xl font-bold text-yellow-600">{summaryStats.pending}</p>
        </div>
      </div>

      {/* Export Button */}
      <div className="flex justify-end">
        <Button onClick={exportToCSV} variant="outline" size="sm" className="gap-2">
          <FileDown className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <p className="text-muted-foreground">Loading receipt history...</p>
        </div>
      ) : receipts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Receipt className="h-12 w-12 mb-2 opacity-50" />
          <p>No receipts found for the selected filters</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Receipt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted By</TableHead>
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
                  <TableCell>{receipt.category?.name || 'Uncategorized'}</TableCell>
                  <TableCell>{receipt.vendor_name || '-'}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(receipt.amount)}</TableCell>
                  <TableCell>
                    {receipt.receipt_scanned ? (
                      <Badge className="bg-green-500/20 text-green-700 border-green-500/30">Scanned</Badge>
                    ) : (
                      <Badge variant="secondary">No</Badge>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(receipt.approval_status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {receipt.created_by_profile?.full_name || receipt.created_by_profile?.email || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openExpenseDetails(receipt)}
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditExpense(receipt);
                          setShowEditDialog(true);
                        }}
                        title="Edit expense"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeleteExpense(receipt);
                            setShowDeleteDialog(true);
                          }}
                          title="Delete expense"
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receipt Details</DialogTitle>
          </DialogHeader>
          {selectedExpense && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">{format(new Date(selectedExpense.date), 'MMMM d, yyyy')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(selectedExpense.approval_status)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vehicle</p>
                  <p className="font-medium">
                    {selectedExpense.vehicle 
                      ? `${selectedExpense.vehicle.make} ${selectedExpense.vehicle.model} (${selectedExpense.vehicle.plate})`
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Branch</p>
                  <p className="font-medium">{selectedExpense.branch?.name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <p className="font-medium">{selectedExpense.category?.name || 'Uncategorized'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vendor</p>
                  <p className="font-medium">{selectedExpense.vendor_name || '-'}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-2">Amount Breakdown</p>
                <div className="space-y-1">
                  {selectedExpense.subtotal && (
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>{formatCurrency(selectedExpense.subtotal)}</span>
                    </div>
                  )}
                  {selectedExpense.tax_amount && (
                    <div className="flex justify-between">
                      <span>Tax</span>
                      <span>{formatCurrency(selectedExpense.tax_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold border-t pt-1">
                    <span>Total</span>
                    <span>{formatCurrency(selectedExpense.amount)}</span>
                  </div>
                </div>
              </div>

              {selectedExpense.description && (
                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p>{selectedExpense.description}</p>
                </div>
              )}

              {/* Receipt Documents Section */}
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-3">Receipt Documents</p>
                {loadingDocuments ? (
                  <p className="text-sm text-muted-foreground">Loading documents...</p>
                ) : expenseDocuments.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted p-3 rounded-md">
                    <FileText className="h-4 w-4" />
                    <span>No documents attached to this expense</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {expenseDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 bg-muted rounded-md"
                      >
                        <div className="flex items-center gap-3">
                          {getFileIcon(doc.file_type)}
                          <div>
                            <p className="text-sm font-medium">{doc.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.file_type || 'Unknown type'}
                              {doc.file_size && ` • ${formatFileSize(doc.file_size)}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDocument(doc)}
                            title="View document"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadDocument(doc)}
                            title="Download document"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-4 flex justify-between text-sm text-muted-foreground">
                <span>
                  Receipt Scanned: {selectedExpense.receipt_scanned ? 'Yes' : 'No'}
                </span>
                <span>
                  Submitted by: {selectedExpense.created_by_profile?.full_name || selectedExpense.created_by_profile?.email || 'Unknown'}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <EditExpenseDialog
        expense={editExpense}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onExpenseUpdated={fetchReceipts}
      />

      {/* Delete Confirmation Dialog - Admin Only */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense? This action will soft-delete the expense record.
              {deleteExpense && (
                <div className="mt-3 p-3 bg-muted rounded-md">
                  <p className="font-medium">{deleteExpense.category?.name || 'Uncategorized'}</p>
                  <p className="text-sm">Amount: {formatCurrency(deleteExpense.amount)}</p>
                  <p className="text-sm">Date: {format(new Date(deleteExpense.date), 'MMM d, yyyy')}</p>
                  <p className="text-sm">Vehicle: {deleteExpense.vehicle ? `${deleteExpense.vehicle.make} ${deleteExpense.vehicle.model} (${deleteExpense.vehicle.plate})` : 'N/A'}</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteExpense}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Expense'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
