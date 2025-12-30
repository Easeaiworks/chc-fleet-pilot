import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Clock, DollarSign, FileText, Download, Eye, RefreshCw, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { EditExpenseDialog } from '@/components/EditExpenseDialog';

interface Document {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
}

interface ExpenseWithDetails {
  id: string;
  amount: number;
  subtotal: number | null;
  tax_amount: number | null;
  date: string;
  description: string;
  approval_status: string;
  created_at: string;
  vehicle_id: string;
  category_id: string | null;
  rejection_reason: string | null;
  vendor_name: string | null;
  staff_name: string | null;
  odometer_reading: number | null;
  vehicles: {
    plate: string;
    make: string;
    model: string;
  } | null;
  expense_categories: {
    name: string;
    type: string;
  } | null;
  profiles: {
    full_name: string;
    email: string;
  } | null;
  documents?: Document[];
}

export default function ExpenseApprovals() {
  const { user, loading: authLoading } = useAuth();
  const { isAdminOrManager, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<ExpenseWithDetails[]>([]);
  const [rejectedExpenses, setRejectedExpenses] = useState<ExpenseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseWithDetails | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [editExpense, setEditExpense] = useState<ExpenseWithDetails | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    // Only fetch expenses when we know the user is authorized
    if (!roleLoading && isAdminOrManager) {
      fetchPendingExpenses();
      fetchRejectedExpenses();
    } else if (!roleLoading && !isAdminOrManager) {
      setLoading(false);
    }
  }, [isAdminOrManager, roleLoading]);

  const fetchPendingExpenses = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          vehicles (plate, make, model),
          expense_categories (name, type),
          created_by_profile:profiles!expenses_created_by_fkey (full_name, email),
          documents (id, file_name, file_path, file_type, file_size)
        `)
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedExpenses = data?.map(expense => ({
        ...expense,
        profiles: expense.created_by_profile,
        documents: expense.documents || []
      })) || [];

      setExpenses(formattedExpenses);
    } catch (error: any) {
      console.error('Error fetching expenses:', error);
      toast({
        title: 'Error',
        description: 'Failed to load pending expenses.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRejectedExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          vehicles (plate, make, model),
          expense_categories (name, type),
          created_by_profile:profiles!expenses_created_by_fkey (full_name, email),
          documents (id, file_name, file_path, file_type, file_size)
        `)
        .eq('approval_status', 'rejected')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedExpenses = data?.map(expense => ({
        ...expense,
        profiles: expense.created_by_profile,
        documents: expense.documents || []
      })) || [];

      setRejectedExpenses(formattedExpenses);
    } catch (error: any) {
      console.error('Error fetching rejected expenses:', error);
    }
  };

  const handleRefreshAll = () => {
    fetchPendingExpenses();
    fetchRejectedExpenses();
  };

  const handleDownloadDocument = async (document: Document) => {
    try {
      setDownloadingFile(document.id);
      
      const { data, error } = await supabase.storage
        .from('vehicle-documents')
        .download(document.file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.file_name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: 'Document downloaded successfully.',
      });
    } catch (error: any) {
      console.error('Error downloading document:', error);
      toast({
        title: 'Error',
        description: 'Failed to download document.',
        variant: 'destructive',
      });
    } finally {
      setDownloadingFile(null);
    }
  };

  const handleViewDocument = async (document: Document) => {
    try {
      setDownloadingFile(document.id);
      
      const { data, error } = await supabase.storage
        .from('vehicle-documents')
        .createSignedUrl(document.file_path, 3600); // 1 hour expiry

      if (error) throw error;

      // Open in new tab
      window.open(data.signedUrl, '_blank');
    } catch (error: any) {
      console.error('Error viewing document:', error);
      toast({
        title: 'Error',
        description: 'Failed to open document.',
        variant: 'destructive',
      });
    } finally {
      setDownloadingFile(null);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleApprove = async (expenseId: string) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          approval_status: 'approved',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', expenseId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Expense approved successfully.',
      });

      fetchPendingExpenses();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve expense.',
        variant: 'destructive',
      });
    }
  };

  const handleReject = async () => {
    if (!selectedExpense || !rejectionReason.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a reason for rejection.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          approval_status: 'rejected',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
        })
        .eq('id', selectedExpense.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Expense rejected.',
      });

      setShowRejectDialog(false);
      setSelectedExpense(null);
      setRejectionReason('');
      fetchPendingExpenses();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject expense.',
        variant: 'destructive',
      });
    }
  };

  if (authLoading || roleLoading) {
    return (
      <Layout>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <h1 className="mb-4 text-2xl font-bold">Loading...</h1>
          </div>
        </div>
      </Layout>
    );
  }

  if (!isAdminOrManager) {
    return (
      <Layout>
        <div className="flex min-h-[400px] items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="p-8 text-center">
              <h2 className="text-xl font-bold mb-2">Access Denied</h2>
              <p className="text-muted-foreground mb-4">
                You must be a manager or admin to access expense approvals.
              </p>
              <Button onClick={() => navigate('/')}>Go to Dashboard</Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Expense Approvals</h1>
          <p className="text-muted-foreground">Review and approve pending expense submissions</p>
        </div>

        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="h-4 w-4" />
              Pending ({expenses.length})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-2">
              <XCircle className="h-4 w-4" />
              Rejected ({rejectedExpenses.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            {loading ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  Loading pending expenses...
                </CardContent>
              </Card>
            ) : expenses.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No pending expenses to review</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {expenses.map((expense) => (
                  <Card key={expense.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5" />
                            ${expense.amount.toLocaleString()}
                          </CardTitle>
                          <CardDescription>
                            Submitted by {expense.profiles?.full_name || 'Unknown'} on{' '}
                            {format(new Date(expense.created_at), 'MMM dd, yyyy')}
                          </CardDescription>
                        </div>
                        <Badge variant="secondary">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium mb-1">Vehicle</p>
                          <p className="text-sm text-muted-foreground">
                            {expense.vehicles
                              ? `${expense.vehicles.make} ${expense.vehicles.model} (${expense.vehicles.plate})`
                              : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-1">Category</p>
                          <p className="text-sm text-muted-foreground">
                            {expense.expense_categories?.name || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-1">Date</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(expense.date), 'MMM dd, yyyy')}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-1">Submitted By</p>
                          <p className="text-sm text-muted-foreground">
                            {expense.profiles?.email || 'N/A'}
                          </p>
                        </div>
                      </div>
                      {expense.description && (
                        <div>
                          <p className="text-sm font-medium mb-1">Description</p>
                          <p className="text-sm text-muted-foreground">{expense.description}</p>
                        </div>
                      )}

                      {/* Documents Section */}
                      {expense.documents && expense.documents.length > 0 && (
                        <div className="border-t pt-4">
                          <p className="text-sm font-medium mb-2 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Attached Documents ({expense.documents.length})
                          </p>
                          <div className="space-y-2">
                            {expense.documents.map((doc) => (
                              <div
                                key={doc.id}
                                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {doc.file_type || 'Unknown type'} • {formatFileSize(doc.file_size)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex gap-2 flex-shrink-0">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleViewDocument(doc)}
                                    disabled={downloadingFile === doc.id}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDownloadDocument(doc)}
                                    disabled={downloadingFile === doc.id}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button
                          onClick={() => handleApprove(expense.id)}
                          className="gap-2"
                          size="sm"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          onClick={() => {
                            setSelectedExpense(expense);
                            setShowRejectDialog(true);
                          }}
                          variant="destructive"
                          size="sm"
                          className="gap-2"
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="rejected">
            {rejectedExpenses.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No rejected expenses</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {rejectedExpenses.map((expense) => (
                  <Card key={expense.id} className="border-l-4 border-l-destructive">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5" />
                            ${expense.amount.toLocaleString()}
                          </CardTitle>
                          <CardDescription>
                            Submitted by {expense.profiles?.full_name || 'Unknown'} on{' '}
                            {format(new Date(expense.created_at), 'MMM dd, yyyy')}
                          </CardDescription>
                        </div>
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Rejected
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Rejection Reason Alert */}
                      {expense.rejection_reason && (
                        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                          <p className="text-sm font-medium flex items-center gap-2 text-destructive mb-1">
                            <AlertTriangle className="h-4 w-4" />
                            Rejection Reason
                          </p>
                          <p className="text-sm text-muted-foreground">{expense.rejection_reason}</p>
                        </div>
                      )}

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium mb-1">Vehicle</p>
                          <p className="text-sm text-muted-foreground">
                            {expense.vehicles
                              ? `${expense.vehicles.make} ${expense.vehicles.model} (${expense.vehicles.plate})`
                              : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-1">Category</p>
                          <p className="text-sm text-muted-foreground">
                            {expense.expense_categories?.name || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-1">Date</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(expense.date), 'MMM dd, yyyy')}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-1">Submitted By</p>
                          <p className="text-sm text-muted-foreground">
                            {expense.profiles?.email || 'N/A'}
                          </p>
                        </div>
                      </div>
                      {expense.description && (
                        <div>
                          <p className="text-sm font-medium mb-1">Description</p>
                          <p className="text-sm text-muted-foreground">{expense.description}</p>
                        </div>
                      )}

                      {/* Documents Section */}
                      {expense.documents && expense.documents.length > 0 && (
                        <div className="border-t pt-4">
                          <p className="text-sm font-medium mb-2 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Attached Documents ({expense.documents.length})
                          </p>
                          <div className="space-y-2">
                            {expense.documents.map((doc) => (
                              <div
                                key={doc.id}
                                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {doc.file_type || 'Unknown type'} • {formatFileSize(doc.file_size)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex gap-2 flex-shrink-0">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleViewDocument(doc)}
                                    disabled={downloadingFile === doc.id}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDownloadDocument(doc)}
                                    disabled={downloadingFile === doc.id}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button
                          onClick={() => {
                            setEditExpense(expense);
                            setShowEditDialog(true);
                          }}
                          variant="outline"
                          size="sm"
                          className="gap-2"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Edit & Re-submit
                        </Button>
                        <Button
                          onClick={() => handleApprove(expense.id)}
                          size="sm"
                          className="gap-2"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Approve As-Is
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Expense</DialogTitle>
              <DialogDescription>
                Please provide a reason for rejecting this expense. The submitter will be notified.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                placeholder="Enter rejection reason..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleReject}>
                  Reject Expense
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <EditExpenseDialog
          expense={editExpense}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onExpenseUpdated={handleRefreshAll}
        />
      </div>
    </Layout>
  );
}
