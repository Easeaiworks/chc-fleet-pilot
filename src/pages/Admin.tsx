import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Layout } from '@/components/Layout';
import { BranchManager } from '@/components/BranchManager';
import { CategoryManager } from '@/components/CategoryManager';
import { BackupRestore } from '@/components/BackupRestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Building2, Tag, CheckSquare, Users, Database } from 'lucide-react';
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
        .select('id, email, full_name')
        .order('email');

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const usersWithRoles: UserWithRoles[] = (profiles || []).map(profile => ({
        ...profile,
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

  const fetchPendingExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          vehicles (vin, plate, make, model),
          profiles (email, full_name),
          expense_categories (name, type)
        `)
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    }
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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="branches" className="gap-2">
              <Building2 className="h-4 w-4" />
              Branches
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <Tag className="h-4 w-4" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="approvals" className="gap-2">
              <CheckSquare className="h-4 w-4" />
              Approvals
              {expenses.length > 0 && (
                <Badge variant="destructive" className="ml-1">{expenses.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              User Roles
            </TabsTrigger>
            <TabsTrigger value="backup" className="gap-2">
              <Database className="h-4 w-4" />
              Backup
            </TabsTrigger>
          </TabsList>

          <TabsContent value="branches" className="space-y-4">
            <BranchManager />
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
            <Card>
              <CardHeader>
                <CardTitle>Assign User Roles</CardTitle>
                <CardDescription>
                  Grant admin, manager, or staff permissions to users
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
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.full_name || user.email}
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
                <CardTitle>Current User Roles</CardTitle>
                <CardDescription>
                  View and manage existing role assignments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{user.full_name || 'No name'}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    <div className="flex gap-2 items-center">
                        {user.roles.length > 0 ? (
                          user.roles.map((role) => (
                            <Badge
                              key={role}
                              variant="secondary"
                              className="gap-2 cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                              onClick={() => handleRemoveRole(user.id, role)}
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
                          onClick={() => handleSendPasswordReset(user.email)}
                        >
                          Reset Password
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
