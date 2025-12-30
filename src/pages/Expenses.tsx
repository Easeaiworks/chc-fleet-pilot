import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, FileDown, Filter, CalendarIcon, DollarSign, TrendingUp, Building2, Car, Receipt } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, startOfYear } from 'date-fns';
import { cn } from '@/lib/utils';
import { AddExpenseDialog } from '@/components/AddExpenseDialog';

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

interface ExpenseRecord {
  id: string;
  amount: number;
  date: string;
  description: string | null;
  approval_status: string;
  vendor_name: string | null;
  staff_name: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  vehicle: { plate: string; make: string | null; model: string | null } | null;
  category: { name: string; type: string } | null;
  branch: { name: string } | null;
  manager_approver: { name: string } | null;
}

interface BranchExpenseSummary {
  branchId: string;
  branchName: string;
  totalAmount: number;
  expenseCount: number;
}

interface CategorySummary {
  category: string;
  amount: number;
}

interface VehicleSummary {
  vehicle: string;
  amount: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--destructive))', '#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

export default function Expenses() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [branchSummaries, setBranchSummaries] = useState<BranchExpenseSummary[]>([]);
  const [categorySummaries, setCategorySummaries] = useState<CategorySummary[]>([]);
  const [vehicleSummaries, setVehicleSummaries] = useState<VehicleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(startOfYear(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  
  const { toast } = useToast();

  useEffect(() => {
    fetchBranchesAndVehicles();
  }, []);

  useEffect(() => {
    fetchExpenseData();
  }, [selectedBranch, selectedVehicle, startDate, endDate]);

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

  const fetchBranchesAndVehicles = async () => {
    const [branchesRes, vehiclesRes] = await Promise.all([
      supabase.from('branches').select('id, name').order('name'),
      supabase.from('vehicles').select('id, plate, make, model, branch_id').order('plate')
    ]);

    if (branchesRes.data) setBranches(branchesRes.data);
    if (vehiclesRes.data) {
      setVehicles(vehiclesRes.data);
      setFilteredVehicles(vehiclesRes.data);
    }
  };

  const fetchExpenseData = async () => {
    setLoading(true);
    const dateStart = startDate ? format(startDate, 'yyyy-MM-dd') : `${new Date().getFullYear()}-01-01`;
    const dateEnd = endDate ? format(endDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

    // Build query
    let query = supabase
      .from('expenses')
      .select(`
        id,
        amount,
        date,
        description,
        approval_status,
        vendor_name,
        staff_name,
        subtotal,
        tax_amount,
        vehicles!inner (plate, make, model, branch_id),
        expense_categories (name, type),
        branches (name),
        manager_approvers (name)
      `)
      .gte('date', dateStart)
      .lte('date', dateEnd)
      .order('date', { ascending: false });

    if (selectedBranch !== 'all') {
      query = query.eq('vehicles.branch_id', selectedBranch);
    }

    if (selectedVehicle !== 'all') {
      query = query.eq('vehicle_id', selectedVehicle);
    }

    const { data } = await query;

    if (data) {
      const formattedExpenses: ExpenseRecord[] = data.map((exp: any) => ({
        id: exp.id,
        amount: Number(exp.amount),
        date: exp.date,
        description: exp.description,
        approval_status: exp.approval_status || 'pending',
        vendor_name: exp.vendor_name,
        staff_name: exp.staff_name,
        subtotal: exp.subtotal ? Number(exp.subtotal) : null,
        tax_amount: exp.tax_amount ? Number(exp.tax_amount) : null,
        vehicle: exp.vehicles,
        category: exp.expense_categories,
        branch: exp.branches,
        manager_approver: exp.manager_approvers
      }));
      setExpenses(formattedExpenses);

      // Calculate branch summaries
      const branchMap = new Map<string, { name: string; amount: number; count: number }>();
      formattedExpenses.forEach(exp => {
        const branchName = exp.branch?.name || 'Unassigned';
        const current = branchMap.get(branchName) || { name: branchName, amount: 0, count: 0 };
        current.amount += exp.amount;
        current.count += 1;
        branchMap.set(branchName, current);
      });
      setBranchSummaries(
        Array.from(branchMap.entries()).map(([id, data]) => ({
          branchId: id,
          branchName: data.name,
          totalAmount: data.amount,
          expenseCount: data.count
        })).sort((a, b) => b.totalAmount - a.totalAmount)
      );

      // Calculate category summaries
      const categoryMap = new Map<string, number>();
      formattedExpenses.forEach(exp => {
        const categoryName = exp.category?.name || 'Uncategorized';
        categoryMap.set(categoryName, (categoryMap.get(categoryName) || 0) + exp.amount);
      });
      setCategorySummaries(
        Array.from(categoryMap.entries()).map(([category, amount]) => ({
          category,
          amount
        })).sort((a, b) => b.amount - a.amount)
      );

      // Calculate vehicle summaries
      const vehicleMap = new Map<string, number>();
      formattedExpenses.forEach(exp => {
        const vehicleName = exp.vehicle 
          ? `${exp.vehicle.make || ''} ${exp.vehicle.model || ''} (${exp.vehicle.plate})`.trim()
          : 'Unknown';
        vehicleMap.set(vehicleName, (vehicleMap.get(vehicleName) || 0) + exp.amount);
      });
      setVehicleSummaries(
        Array.from(vehicleMap.entries()).map(([vehicle, amount]) => ({
          vehicle,
          amount
        })).sort((a, b) => b.amount - a.amount).slice(0, 10) // Top 10 vehicles
      );
    } else {
      setExpenses([]);
      setBranchSummaries([]);
      setCategorySummaries([]);
      setVehicleSummaries([]);
    }

    setLoading(false);
  };

  // Exclude rejected from YTD total
  const totalYTD = expenses.filter(e => e.approval_status !== 'rejected').reduce((sum, exp) => sum + exp.amount, 0);
  const approvedTotal = expenses.filter(e => e.approval_status === 'approved').reduce((sum, exp) => sum + exp.amount, 0);
  const pendingTotal = expenses.filter(e => e.approval_status === 'pending').reduce((sum, exp) => sum + exp.amount, 0);
  const rejectedTotal = expenses.filter(e => e.approval_status === 'rejected').reduce((sum, exp) => sum + exp.amount, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500/20 text-green-700 border-green-500/30">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Vehicle', 'Category', 'Vendor', 'Staff', 'Subtotal', 'Tax', 'Total', 'Status', 'Description'];
    const rows = expenses.map(exp => [
      exp.date,
      `${exp.vehicle?.make || ''} ${exp.vehicle?.model || ''} (${exp.vehicle?.plate || 'N/A'})`,
      exp.category?.name || 'Uncategorized',
      exp.vendor_name || '',
      exp.staff_name || '',
      exp.subtotal?.toFixed(2) || '',
      exp.tax_amount?.toFixed(2) || '',
      exp.amount.toFixed(2),
      exp.approval_status,
      exp.description || ''
    ]);

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();

    toast({ title: 'Success', description: 'Expenses exported to CSV' });
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Expense Management</h1>
            <p className="text-muted-foreground">Track, manage, and report on fleet expenses</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <AddExpenseDialog vehicleId="" onExpenseAdded={fetchExpenseData} />
            <Button onClick={exportToCSV} variant="outline" className="gap-2">
              <FileDown className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-5 gap-4">
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">YTD Total</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalYTD)}</p>
                  <p className="text-xs text-muted-foreground">Excl. rejected</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Approved</p>
                  <p className="text-2xl font-bold">{formatCurrency(approvedTotal)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <Receipt className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{formatCurrency(pendingTotal)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card border-l-4 border-l-destructive/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-destructive/10 rounded-lg">
                  <Receipt className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rejected</p>
                  <p className="text-2xl font-bold text-destructive">{formatCurrency(rejectedTotal)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-secondary/20 rounded-lg">
                  <Car className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Transactions</p>
                  <p className="text-2xl font-bold">{expenses.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Branch</label>
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select branch" />
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
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Vehicle</label>
                  <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select vehicle" />
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
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Start Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal bg-background", !startDate && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : <span>Pick start date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">End Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal bg-background", !endDate && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : <span>Pick end date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <p className="text-muted-foreground">Loading expenses...</p>
          </div>
        ) : (
          <>
            {/* Charts */}
            <div className="grid md:grid-cols-3 gap-6">
              {/* By Branch */}
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    By Branch
                  </CardTitle>
                  <CardDescription>Spending per location</CardDescription>
                </CardHeader>
                <CardContent>
                  {branchSummaries.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={branchSummaries}
                          dataKey="totalAmount"
                          nameKey="branchName"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={(entry) => entry.branchName}
                        >
                          {branchSummaries.map((_, index) => (
                            <Cell key={`cell-branch-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      No expense data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* By Category */}
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>By Category</CardTitle>
                  <CardDescription>Breakdown by expense type</CardDescription>
                </CardHeader>
                <CardContent>
                  {categorySummaries.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={categorySummaries}
                          dataKey="amount"
                          nameKey="category"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={(entry) => entry.category}
                        >
                          {categorySummaries.map((_, index) => (
                            <Cell key={`cell-cat-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      No expense data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* By Vehicle */}
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Car className="h-5 w-5 text-primary" />
                    By Vehicle
                  </CardTitle>
                  <CardDescription>Top 10 vehicles by spending</CardDescription>
                </CardHeader>
                <CardContent>
                  {vehicleSummaries.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={vehicleSummaries}
                          dataKey="amount"
                          nameKey="vehicle"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={(entry) => entry.vehicle.split('(')[1]?.replace(')', '') || entry.vehicle}
                        >
                          {vehicleSummaries.map((_, index) => (
                            <Cell key={`cell-veh-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      No expense data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Expense List */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Recent Expenses</CardTitle>
                <CardDescription>All expense transactions</CardDescription>
              </CardHeader>
              <CardContent>
                {expenses.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Vehicle</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead>Staff</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expenses.slice(0, 50).map((expense) => (
                          <TableRow key={expense.id}>
                            <TableCell>{format(new Date(expense.date), 'MMM d, yyyy')}</TableCell>
                            <TableCell>
                              {expense.vehicle ? `${expense.vehicle.make || ''} ${expense.vehicle.model || ''} (${expense.vehicle.plate})` : 'N/A'}
                            </TableCell>
                            <TableCell>{expense.category?.name || 'Uncategorized'}</TableCell>
                            <TableCell>{expense.vendor_name || '-'}</TableCell>
                            <TableCell>{expense.staff_name || '-'}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(expense.amount)}</TableCell>
                            <TableCell>{getStatusBadge(expense.approval_status)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {expenses.length > 50 && (
                      <p className="text-sm text-muted-foreground text-center mt-4">
                        Showing 50 of {expenses.length} expenses. Export to CSV for full list.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No expenses found for selected filters</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
