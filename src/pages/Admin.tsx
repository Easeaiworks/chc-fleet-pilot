import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Layout } from '@/components/Layout';
import { BranchManager } from '@/components/BranchManager';
import { CategoryManager } from '@/components/CategoryManager';
import { VendorManager } from '@/components/VendorManager';
import { BackupRestore } from '@/components/BackupRestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Building2, Tag, CheckSquare, Users, Database, FileText, Download, Eye, Store } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface UserWithRoles {
  id: string;
  email: string;
  full_name: string | null;
  roles: string[];
  is_approved: boolean;
  is_blocked: boolean;
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
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);


  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin && !roleLoading) {
      fetchUsers();
      fetchPendingExpenses();
    }
  }, [user, isAdmin, roleLoading]);

    const fetchUsers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, is_approved, is_blocked')
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
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
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
          <TabsList className="grid w-full grid-cols-6">
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
            <TabsTrigger value="approvals" className="gap-2">
              <CheckSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Approvals</span>
              {expenses.length > 0 && (
                <Badge variant="destructive" className="ml-1">{expenses.length}</Badge>
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
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{approvedUser.full_name || 'No name'}</p>
                        <p className="text-sm text-muted-foreground">{approvedUser.email}</p>
                      </div>
                      <div className="flex gap-2 items-center">
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
