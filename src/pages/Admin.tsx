import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Layout } from '@/components/Layout';
import { BranchManager } from '@/components/BranchManager';
import { CategoryManager } from '@/components/CategoryManager';
import { VendorManager } from '@/components/VendorManager';
import { BackupRestore } from '@/components/BackupRestore';
import { PreapprovalRulesManager } from '@/components/PreapprovalRulesManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Building2, Tag, CheckSquare, Users, Database, FileText, Download, Eye, Store, Trash2, RotateCcw, ShieldCheck } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { emitExpensesChanged } from '@/utils/expensesEvents';

interface UserWithRoles {
  id: string;
  email: string;
  full_name: string | null;
  roles: string[];
  is_approved: boolean;
  is_blocked: boolean;
  default_branch_id: string | null;
}

interface Branch {
  id: string;
  name: string;
}

interface Document {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
}

interface Expense {
  id: string;
  amount: number;
  date: string;
  description: string | null;
  approval_status: string | null;
  created_by: string | null;
  vehicle_id: string;
  vehicles: {
    vin: string;
    plate: string;
    make: string | null;
    model: string | null;
  } | null;
  profiles: {
    email: string;
    full_name: string | null;
  } | null;
  expense_categories: {
    name: string;
    type: string;
  } | null;
  documents?: Document[];
}

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading, roles } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [deletedExpenses, setDeletedExpenses] = useState<(Expense & { deleted_at: string; deleted_by: string | null })[]>([]);


  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin && !roleLoading) {
      fetchUsers();
      fetchBranches();
      fetchPendingExpenses();
      fetchDeletedExpenses();
    }
  }, [user, isAdmin, roleLoading]);

  const fetchBranches = async () => {
    const { data } = await supabase.from('branches').select('id, name').order('name');
    if (data) setBranches(data);
  };

    const fetchUsers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, is_approved, is_blocked, default_branch_id')
        .order('email');

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const usersWithRoles: UserWithRoles[] = (profiles || []).map(profile => ({
        ...profile,
        is_approved: profile.is_approved ?? false,
        is_blocked: profile.is_blocked ?? false,
        default_branch_id: profile.default_branch_id || null,
        roles: roles?.filter(r => r.user_id === profile.id).map(r => r.role) || []
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleApproveUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_approved: true,
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'User approved successfully',
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve user',
        variant: 'destructive',
      });
    }
  };
  
  const handleRevokeApproval = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_approved: false,
          approved_by: null,
          approved_at: null,
        })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'User access revoked',
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to revoke access',
        variant: 'destructive',
      });
    }
  };

  const handleBlockUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_blocked: true,
          blocked_by: user?.id,
          blocked_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'User Blocked',
        description: 'User has been blocked and cannot sign up or log in again.',
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to block user',
        variant: 'destructive',
      });
    }
  };

  const handleUnblockUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_blocked: false,
          blocked_by: null,
          blocked_at: null,
        })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'User Unblocked',
        description: 'User has been unblocked.',
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to unblock user',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateDefaultBranch = async (userId: string, branchId: string | null) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          default_branch_id: branchId,
        })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Default branch updated',
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update default branch',
        variant: 'destructive',
      });
    }
  };

  const fetchPendingExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          vehicles (vin, plate, make, model),
          profiles (email, full_name),
          expense_categories (name, type),
          documents (id, file_name, file_path, file_type, file_size)
        `)
        .eq('approval_status', 'pending')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    }
  };

  const fetchDeletedExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          vehicles (vin, plate, make, model),
          profiles (email, full_name),
          expense_categories (name, type),
          documents (id, file_name, file_path, file_type, file_size)
        `)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (error) throw error;
      setDeletedExpenses(data || []);
    } catch (error) {
      console.error('Error fetching deleted expenses:', error);
    }
  };

  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  const handleViewDocument = async (doc: Document) => {
    try {
      setDownloadingFile(doc.id);
      const { data, error } = await supabase.storage
        .from('vehicle-documents')
        .createSignedUrl(doc.file_path, 3600);

      if (error) throw error;
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

  const handleDownloadDocument = async (doc: Document) => {
    try {
      setDownloadingFile(doc.id);
      const { data, error } = await supabase.storage
        .from('vehicle-documents')
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
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

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleAssignRole = async () => {
    if (!selectedUser || !selectedRole) {
      toast({
        title: 'Error',
        description: 'Please select both a user and a role',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: selectedUser, role: selectedRole });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Role assigned successfully',
      });

      setSelectedUser('');
      setSelectedRole('');
      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to assign role',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveRole = async (userId: string, role: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Role removed successfully',
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove role',
        variant: 'destructive',
      });
    }
  };

  const handleApproval = async (expenseId: string, status: 'approved' | 'rejected', rejectionReason?: string) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          approval_status: status,
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          rejection_reason: status === 'rejected' ? rejectionReason : null,
        })
        .eq('id', expenseId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Expense ${status} successfully`,
      });

      fetchPendingExpenses();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update expense',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      // Soft delete - set deleted_at and deleted_by
      const { error } = await supabase
        .from('expenses')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id,
        })
        .eq('id', expenseId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Expense moved to recycle bin',
      });

      emitExpensesChanged();
      fetchPendingExpenses();
      fetchDeletedExpenses();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete expense',
        variant: 'destructive',
      });
    }
  };

  const handleRestoreExpense = async (expenseId: string) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          deleted_at: null,
          deleted_by: null,
        })
        .eq('id', expenseId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Expense restored successfully',
      });

      emitExpensesChanged();
      fetchPendingExpenses();
      fetchDeletedExpenses();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to restore expense',
        variant: 'destructive',
      });
    }
  };

  const handlePermanentlyDeleteExpense = async (expenseId: string) => {
    try {
      // Find the expense to get its documents
      const expenseToDelete = deletedExpenses.find(e => e.id === expenseId);
      
      // Delete files from storage first
      if (expenseToDelete?.documents && expenseToDelete.documents.length > 0) {
        const filePaths = expenseToDelete.documents.map(doc => doc.file_path);
        const { error: storageError } = await supabase.storage
          .from('vehicle-documents')
          .remove(filePaths);
        
        if (storageError) {
          console.error('Error deleting files from storage:', storageError);
        }
        
        // Delete document records
        const { error: docsError } = await supabase
          .from('documents')
          .delete()
          .eq('expense_id', expenseId);
          
        if (docsError) {
          console.error('Error deleting document records:', docsError);
        }
      }

      // Permanently delete the expense record
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Expense permanently deleted',
      });

      fetchDeletedExpenses();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to permanently delete expense',
        variant: 'destructive',
      });
    }
  };

  const handleSendPasswordReset = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?reset=true`,
      });

      if (error) throw error;

      toast({
        title: 'Password Reset Email Sent',
        description: `A password reset link has been sent to ${email}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send password reset email',
        variant: 'destructive',
      });
    }
  };

  if (authLoading || roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Access denied. Admin privileges required.</p>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Loading admin data...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Admin Panel
          </h1>
          <p className="text-muted-foreground">Manage all system configurations and user permissions</p>
        </div>

        <Tabs defaultValue="branches" className="w-full">
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="branches" className="gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Branches</span>
            </TabsTrigger>
            <TabsTrigger value="vendors" className="gap-2">
              <Store className="h-4 w-4" />
              <span className="hidden sm:inline">Vendors</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <Tag className="h-4 w-4" />
              <span className="hidden sm:inline">Categories</span>
            </TabsTrigger>
            <TabsTrigger value="preapproval" className="gap-2">
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Pre-Approval</span>
            </TabsTrigger>
            <TabsTrigger value="approvals" className="gap-2">
              <CheckSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Approvals</span>
              {expenses.length > 0 && (
                <Badge variant="destructive" className="ml-1">{expenses.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="deleted" className="gap-2">
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Deleted</span>
              {deletedExpenses.length > 0 && (
                <Badge variant="secondary" className="ml-1">{deletedExpenses.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Users</span>
              {users.filter(u => !u.is_approved && !u.is_blocked).length > 0 && (
                <Badge variant="secondary" className="ml-1 bg-amber-500 text-white hover:bg-amber-500">{users.filter(u => !u.is_approved && !u.is_blocked).length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="backup" className="gap-2">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">Backup</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="branches" className="space-y-4">
            <BranchManager />
          </TabsContent>

          <TabsContent value="vendors" className="space-y-4">
            <VendorManager />
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <CategoryManager />
          </TabsContent>

          <TabsContent value="preapproval" className="space-y-4">
            <PreapprovalRulesManager />
          </TabsContent>

          <TabsContent value="approvals" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pending Expense Approvals</CardTitle>
                <CardDescription>
                  Review and approve or reject expense submissions from staff
                </CardDescription>
              </CardHeader>
              <CardContent>
                {expenses.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No pending approvals
                  </p>
                ) : (
                  <div className="space-y-4">
                    {expenses.map((expense) => (
                      <Card key={expense.id}>
                        <CardContent className="pt-6">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">
                                  {expense.expense_categories?.type || 'Uncategorized'}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {expense.expense_categories?.name}
                                </span>
                              </div>
                              <p className="font-medium">
                                {expense.vehicles?.make} {expense.vehicles?.model} - {expense.vehicles?.plate}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {expense.description}
                              </p>
                              <div className="flex gap-4 text-sm">
                                <span>Date: {format(new Date(expense.date), 'MMM dd, yyyy')}</span>
                                <span className="font-semibold">${expense.amount.toFixed(2)}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Submitted by: {expense.profiles?.full_name || expense.profiles?.email}
                              </p>
                              
                              {/* Documents Section */}
                              {expense.documents && expense.documents.length > 0 && (
                                <div className="mt-3 pt-3 border-t">
                                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Attached Documents ({expense.documents.length})
                                  </p>
                                  <div className="space-y-2">
                                    {expense.documents.map((doc) => (
                                      <div
                                        key={doc.id}
                                        className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                          <div className="min-w-0">
                                            <p className="font-medium truncate">{doc.file_name}</p>
                                            <p className="text-xs text-muted-foreground">
                                              {doc.file_type || 'Unknown'} • {formatFileSize(doc.file_size)}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="flex gap-1 flex-shrink-0">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleViewDocument(doc)}
                                            disabled={downloadingFile === doc.id}
                                          >
                                            <Eye className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDownloadDocument(doc)}
                                            disabled={downloadingFile === doc.id}
                                          >
                                            <Download className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleApproval(expense.id, 'approved')}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  const reason = prompt('Rejection reason (optional):');
                                  handleApproval(expense.id, 'rejected', reason || undefined);
                                }}
                              >
                                Reject
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Expense</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to permanently delete this expense? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteExpense(expense.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deleted" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5" />
                  Deleted Expenses (Recycle Bin)
                </CardTitle>
                <CardDescription>
                  Review and restore deleted expenses, or permanently delete them
                </CardDescription>
              </CardHeader>
              <CardContent>
                {deletedExpenses.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No deleted expenses
                  </p>
                ) : (
                  <div className="space-y-4">
                    {deletedExpenses.map((expense) => (
                      <Card key={expense.id} className="border-muted">
                        <CardContent className="pt-6">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">
                                  {expense.expense_categories?.type || 'Uncategorized'}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {expense.expense_categories?.name}
                                </span>
                              </div>
                              <p className="font-medium">
                                {expense.vehicles?.make} {expense.vehicles?.model} - {expense.vehicles?.plate}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {expense.description}
                              </p>
                              <div className="flex gap-4 text-sm">
                                <span>Date: {format(new Date(expense.date), 'MMM dd, yyyy')}</span>
                                <span className="font-semibold">${expense.amount.toFixed(2)}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Submitted by: {expense.profiles?.full_name || expense.profiles?.email}
                              </p>
                              <p className="text-xs text-destructive">
                                Deleted: {format(new Date(expense.deleted_at), 'MMM dd, yyyy h:mm a')}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleRestoreExpense(expense.id)}
                              >
                                <RotateCcw className="h-4 w-4 mr-1" />
                                Restore
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="sm">
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Delete Forever
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Permanently Delete Expense</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete this expense and all associated documents. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handlePermanentlyDeleteExpense(expense.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete Forever
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            {/* Pending Approvals Section */}
            {users.filter(u => !u.is_approved && !u.is_blocked).length > 0 && (
              <Card className="border-amber-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-amber-500" />
                    Pending User Approvals
                  </CardTitle>
                  <CardDescription>
                    These users have signed up and are waiting for approval to access the system
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {users.filter(u => !u.is_approved && !u.is_blocked).map((pendingUser) => (
                      <div
                        key={pendingUser.id}
                        className="flex items-center justify-between p-4 border border-amber-500/50 rounded-lg bg-amber-500/5"
                      >
                        <div>
                          <p className="font-medium">{pendingUser.full_name || 'No name'}</p>
                          <p className="text-sm text-muted-foreground">{pendingUser.email}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleApproveUser(pendingUser.id)}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleBlockUser(pendingUser.id)}
                          >
                            Deny & Block
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Blocked Users Section */}
            {users.filter(u => u.is_blocked).length > 0 && (
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <Shield className="h-5 w-5" />
                    Blocked Users
                  </CardTitle>
                  <CardDescription>
                    These users have been blocked and cannot access the system
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {users.filter(u => u.is_blocked).map((blockedUser) => (
                      <div
                        key={blockedUser.id}
                        className="flex items-center justify-between p-4 border border-destructive/50 rounded-lg bg-destructive/5"
                      >
                        <div>
                          <p className="font-medium">{blockedUser.full_name || 'No name'}</p>
                          <p className="text-sm text-muted-foreground">{blockedUser.email}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUnblockUser(blockedUser.id)}
                        >
                          Unblock
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            
            <Card>
              <CardHeader>
                <CardTitle>Assign User Roles</CardTitle>
                <CardDescription>
                  Grant admin, manager, or staff permissions to approved users
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-2 block">Select User</label>
                    <select
                      className="w-full border rounded-md p-2"
                      value={selectedUser}
                      onChange={(e) => setSelectedUser(e.target.value)}
                    >
                      <option value="">Choose a user...</option>
                      {users.filter(u => u.is_approved).map((approvedUser) => (
                        <option key={approvedUser.id} value={approvedUser.id}>
                          {approvedUser.full_name || approvedUser.email}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-2 block">Select Role</label>
                    <select
                      className="w-full border rounded-md p-2"
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                    >
                      <option value="">Choose a role...</option>
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="staff">Staff</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleAssignRole}>
                      Assign Role
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Approved Users & Roles</CardTitle>
                <CardDescription>
                  View and manage existing role assignments. Click a role badge to remove it.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {users
                    .filter(u => u.is_approved)
                    .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
                    .map((approvedUser) => (
                    <div
                      key={approvedUser.id}
                      className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg gap-4"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{approvedUser.full_name || 'No name'}</p>
                        <p className="text-sm text-muted-foreground">{approvedUser.email}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-muted-foreground">Default Branch:</span>
                          <select
                            className="text-xs border rounded px-2 py-1 bg-background"
                            value={approvedUser.default_branch_id || ''}
                            onChange={(e) => handleUpdateDefaultBranch(approvedUser.id, e.target.value || null)}
                          >
                            <option value="">None</option>
                            {branches.map((branch) => (
                              <option key={branch.id} value={branch.id}>
                                {branch.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        {approvedUser.roles.length > 0 ? (
                          approvedUser.roles.map((role) => (
                            <Badge
                              key={role}
                              variant="secondary"
                              className="gap-2 cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                              onClick={() => handleRemoveRole(approvedUser.id, role)}
                            >
                              {role}
                              <span className="text-xs">×</span>
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">No roles assigned</span>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendPasswordReset(approvedUser.email)}
                        >
                          Reset Password
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRevokeApproval(approvedUser.id)}
                        >
                          Revoke Access
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="backup" className="space-y-4">
            <BackupRestore />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Admin;
