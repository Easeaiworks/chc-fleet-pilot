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
import { Download, FileDown, Filter, CalendarIcon, DollarSign, TrendingUp, Building2, Car, Receipt, Fuel, ChevronDown, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { format, startOfYear } from 'date-fns';
import { cn } from '@/lib/utils';
import { AddExpenseDialog } from '@/components/AddExpenseDialog';
import { ReceiptHistory } from '@/components/ReceiptHistory';
import { FuelReceiptHistory } from '@/components/FuelReceiptHistory';
import { EXPENSES_CHANGED_EVENT } from '@/utils/expensesEvents';

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

interface FuelExpense {
  totalAmount: number;
  receiptCount: number;
  byBranch: { branchId: string; branchName: string; amount: number; receiptCount: number }[];
  byVehicle: { vehicleId: string; plate: string; make: string | null; model: string | null; branchName: string; branchId: string; amount: number; receiptCount: number }[];
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
  const [fuelExpenses, setFuelExpenses] = useState<FuelExpense>({ totalAmount: 0, receiptCount: 0, byBranch: [], byVehicle: [] });
  const [expandedFuelBranches, setExpandedFuelBranches] = useState<Set<string>>(new Set());
  const [fuelSummaryOpen, setFuelSummaryOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(startOfYear(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  
  const { toast } = useToast();

  const toggleFuelBranch = (branchId: string) => {
    setExpandedFuelBranches(prev => {
      const newSet = new Set(prev);
      if (newSet.has(branchId)) {
        newSet.delete(branchId);
      } else {
        newSet.add(branchId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    fetchBranchesAndVehicles();
  }, []);

  useEffect(() => {
    fetchExpenseData();
    fetchFuelExpenses();
  }, [selectedBranch, selectedVehicle, startDate, endDate]);

  useEffect(() => {
    const onExpensesChanged = () => {
      fetchExpenseData();
      fetchFuelExpenses();
    };

    window.addEventListener(EXPENSES_CHANGED_EVENT, onExpensesChanged);
    return () => window.removeEventListener(EXPENSES_CHANGED_EVENT, onExpensesChanged);
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
      .is('deleted_at', null)
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

  const fetchFuelExpenses = async () => {
    const dateStart = startDate ? format(startDate, 'yyyy-MM-dd') : `${new Date().getFullYear()}-01-01`;
    const dateEnd = endDate ? format(endDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

    let fuelQuery = supabase
      .from('fuel_receipts')
      .select(`
        id,
        amount,
        date,
        vehicle_id,
        branch_id,
        vehicles (id, plate, make, model, branch_id),
        branches (id, name)
      `)
      .gte('date', dateStart)
      .lte('date', dateEnd);

    if (selectedBranch !== 'all') {
      fuelQuery = fuelQuery.eq('branch_id', selectedBranch);
    }

    if (selectedVehicle !== 'all') {
      fuelQuery = fuelQuery.eq('vehicle_id', selectedVehicle);
    }

    const { data: fuelData } = await fuelQuery;

    if (fuelData && fuelData.length > 0) {
      let totalAmount = 0;
      const branchMap = new Map<string, { name: string; amount: number; count: number }>();
      const vehicleMap = new Map<string, { plate: string; make: string | null; model: string | null; branchName: string; branchId: string; amount: number; count: number }>();

      fuelData.forEach((fuel: any) => {
        const amount = Number(fuel.amount) || 0;
        totalAmount += amount;

        // By branch
        const branchId = fuel.branch_id || fuel.vehicles?.branch_id || 'unassigned';
        const branchName = fuel.branches?.name || 'Unassigned';
        const branchCurrent = branchMap.get(branchId) || { name: branchName, amount: 0, count: 0 };
        branchCurrent.amount += amount;
        branchCurrent.count += 1;
        branchMap.set(branchId, branchCurrent);

        // By vehicle
        if (fuel.vehicle_id && fuel.vehicles) {
          const vehicleCurrent = vehicleMap.get(fuel.vehicle_id) || {
            plate: fuel.vehicles.plate,
            make: fuel.vehicles.make,
            model: fuel.vehicles.model,
            branchName: branchName,
            branchId: branchId,
            amount: 0,
            count: 0,
          };
          vehicleCurrent.amount += amount;
          vehicleCurrent.count += 1;
          vehicleMap.set(fuel.vehicle_id, vehicleCurrent);
        }
      });

      const byBranch = Array.from(branchMap.entries())
        .map(([branchId, data]) => ({
          branchId,
          branchName: data.name,
          amount: data.amount,
          receiptCount: data.count,
        }))
        .sort((a, b) => b.amount - a.amount);

      const byVehicle = Array.from(vehicleMap.entries())
        .map(([vehicleId, data]) => ({
          vehicleId,
          plate: data.plate,
          make: data.make,
          model: data.model,
          branchName: data.branchName,
          branchId: data.branchId,
          amount: data.amount,
          receiptCount: data.count,
        }))
        .sort((a, b) => b.amount - a.amount);

      setFuelExpenses({
        totalAmount,
        receiptCount: fuelData.length,
        byBranch,
        byVehicle,
      });
    } else {
      setFuelExpenses({ totalAmount: 0, receiptCount: 0, byBranch: [], byVehicle: [] });
    }
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
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* By Branch */}
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="h-5 w-5 text-primary" />
                    By Branch
                  </CardTitle>
                  <CardDescription className="text-xs">Spending per location</CardDescription>
                </CardHeader>
                <CardContent>
                  {branchSummaries.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={branchSummaries}
                          dataKey="totalAmount"
                          nameKey="branchName"
                          cx="50%"
                          cy="50%"
                          outerRadius={55}
                          label={({ name, percent }) => {
                            const displayName = name.length > 10 ? `${name.substring(0, 8)}...` : name;
                            return `${displayName} ${(percent * 100).toFixed(0)}%`;
                          }}
                          labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                        >
                          {branchSummaries.map((_, index) => (
                            <Cell key={`cell-branch-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value) => formatCurrency(Number(value))}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px',
                            fontSize: '12px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                      No expense data
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* By Category */}
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">By Category</CardTitle>
                  <CardDescription className="text-xs">Breakdown by expense type</CardDescription>
                </CardHeader>
                <CardContent>
                  {categorySummaries.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={categorySummaries}
                          dataKey="amount"
                          nameKey="category"
                          cx="50%"
                          cy="50%"
                          outerRadius={55}
                          label={({ name, percent }) => {
                            const displayName = name.length > 10 ? `${name.substring(0, 8)}...` : name;
                            return `${displayName} ${(percent * 100).toFixed(0)}%`;
                          }}
                          labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                        >
                          {categorySummaries.map((_, index) => (
                            <Cell key={`cell-cat-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value) => formatCurrency(Number(value))}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px',
                            fontSize: '12px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                      No expense data
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* By Vehicle */}
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Car className="h-5 w-5 text-primary" />
                    By Vehicle
                  </CardTitle>
                  <CardDescription className="text-xs">Top 10 by spending</CardDescription>
                </CardHeader>
                <CardContent>
                  {vehicleSummaries.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={vehicleSummaries}
                          dataKey="amount"
                          nameKey="vehicle"
                          cx="50%"
                          cy="50%"
                          outerRadius={55}
                          label={({ name, percent }) => {
                            const plate = name.split('(')[1]?.replace(')', '') || name;
                            const displayName = plate.length > 8 ? `${plate.substring(0, 6)}...` : plate;
                            return `${displayName} ${(percent * 100).toFixed(0)}%`;
                          }}
                          labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                        >
                          {vehicleSummaries.map((_, index) => (
                            <Cell key={`cell-veh-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value) => formatCurrency(Number(value))}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px',
                            fontSize: '12px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                      No expense data
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Fuel by Location Pie Chart */}
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Fuel className="h-5 w-5 text-amber-600" />
                    Fuel by Location
                  </CardTitle>
                  <CardDescription className="text-xs">Fuel expenses distribution</CardDescription>
                </CardHeader>
                <CardContent>
                  {fuelExpenses.byBranch.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={fuelExpenses.byBranch}
                          dataKey="amount"
                          nameKey="branchName"
                          cx="50%"
                          cy="50%"
                          outerRadius={55}
                          label={({ name, percent }) => {
                            const displayName = name.length > 10 ? `${name.substring(0, 8)}...` : name;
                            return `${displayName} ${(percent * 100).toFixed(0)}%`;
                          }}
                          labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                        >
                          {fuelExpenses.byBranch.map((_, index) => (
                            <Cell key={`cell-fuel-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value) => formatCurrency(Number(value))}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px',
                            fontSize: '12px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                      No fuel data
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Receipt History */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  Receipt History
                </CardTitle>
                <CardDescription>Scanned receipts and extracted data for accounting summary</CardDescription>
              </CardHeader>
              <CardContent>
                <ReceiptHistory />
              </CardContent>
            </Card>

            {/* Fuel Receipt History */}
            <FuelReceiptHistory />

            {/* Company Fuel Summary - Expandable to Branches then Vehicles */}
            <Collapsible open={fuelSummaryOpen} onOpenChange={setFuelSummaryOpen}>
              <Card className="shadow-card border-l-4 border-l-amber-500">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-lg">
                          <Fuel className="h-6 w-6 text-amber-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Company Total Fuel Expenses</CardTitle>
                          <CardDescription className="text-sm">
                            {fuelExpenses.receiptCount} receipts across {fuelExpenses.byBranch.length} locations
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-amber-600">{formatCurrency(fuelExpenses.totalAmount)}</p>
                          <p className="text-xs text-muted-foreground">Total fuel spend</p>
                        </div>
                        {fuelSummaryOpen ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 pb-4">
                    {fuelExpenses.byBranch.length > 0 ? (
                      <div className="space-y-2">
                        {fuelExpenses.byBranch.map((branch) => {
                          const branchVehicles = fuelExpenses.byVehicle.filter(v => v.branchId === branch.branchId);
                          const isExpanded = expandedFuelBranches.has(branch.branchId);
                          
                          return (
                            <Collapsible
                              key={branch.branchId}
                              open={isExpanded}
                              onOpenChange={() => toggleFuelBranch(branch.branchId)}
                            >
                              <div className="border rounded-md overflow-hidden">
                                <CollapsibleTrigger asChild>
                                  <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors bg-muted/20">
                                    <div className="flex items-center gap-3">
                                      {isExpanded ? (
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <Building2 className="h-4 w-4 text-muted-foreground" />
                                      <span className="font-medium">{branch.branchName}</span>
                                      <Badge variant="secondary" className="text-xs">
                                        {branch.receiptCount} receipts
                                      </Badge>
                                    </div>
                                    <span className="font-semibold text-amber-600">{formatCurrency(branch.amount)}</span>
                                  </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="border-t bg-background">
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="text-xs">
                                          <TableHead className="pl-12">Vehicle</TableHead>
                                          <TableHead className="text-right">Receipts</TableHead>
                                          <TableHead className="text-right w-28">Amount</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {branchVehicles.map((vehicle) => (
                                          <TableRow key={vehicle.vehicleId} className="text-sm">
                                            <TableCell className="pl-12 py-2">
                                              <div className="flex items-center gap-2">
                                                <Car className="h-3 w-3 text-muted-foreground" />
                                                {vehicle.make} {vehicle.model} <span className="text-muted-foreground">({vehicle.plate})</span>
                                              </div>
                                            </TableCell>
                                            <TableCell className="text-right py-2 text-muted-foreground">
                                              {vehicle.receiptCount}
                                            </TableCell>
                                            <TableCell className="text-right py-2 font-medium">
                                              {formatCurrency(vehicle.amount)}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                        {branchVehicles.length === 0 && (
                                          <TableRow>
                                            <TableCell colSpan={3} className="text-center py-4 text-muted-foreground text-sm">
                                              No vehicle breakdown available
                                            </TableCell>
                                          </TableRow>
                                        )}
                                      </TableBody>
                                      <TableFooter>
                                        <TableRow className="bg-muted/30">
                                          <TableCell className="pl-12 font-medium">Branch Total</TableCell>
                                          <TableCell className="text-right">{branch.receiptCount}</TableCell>
                                          <TableCell className="text-right font-bold text-amber-600">{formatCurrency(branch.amount)}</TableCell>
                                        </TableRow>
                                      </TableFooter>
                                    </Table>
                                  </div>
                                </CollapsibleContent>
                              </div>
                            </Collapsible>
                          );
                        })}
                        
                        {/* Company Total Footer */}
                        <div className="border-t pt-3 mt-3">
                          <div className="flex items-center justify-between px-4 py-2 bg-amber-500/10 rounded-md">
                            <span className="font-semibold">Company Total</span>
                            <span className="text-xl font-bold text-amber-600">{formatCurrency(fuelExpenses.totalAmount)}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-8 text-muted-foreground">
                        No fuel expense data for the selected period
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </>
        )}
      </div>
    </Layout>
  );
}
