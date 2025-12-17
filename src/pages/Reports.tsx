import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, FileDown, TrendingUp, Filter, CalendarIcon, Building2, Navigation, AlertTriangle } from 'lucide-react';
import { GPSReportSection } from '@/components/GPSReportSection';
import { InspectionReports } from '@/components/InspectionReports';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ExpenseByCategory {
  category: string;
  amount: number;
  type: string;
}

interface MonthlyExpense {
  month: string;
  amount: number;
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
  odometer_km: number | null;
}

interface BranchExpense {
  branchId: string;
  branchName: string;
  totalAmount: number;
  vehicleCount: number;
  expenseCount: number;
}

interface FleetKilometers {
  totalKm: number;
  byBranch: { branchId: string; branchName: string; kilometers: number; vehicleCount: number }[];
  byVehicle: { vehicleId: string; plate: string; make: string | null; model: string | null; branchName: string; kilometers: number }[];
}

const COLORS = ['hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--primary))', 'hsl(var(--destructive))', '#8884d8', '#82ca9d'];

export default function Reports() {
  const [expensesByCategory, setExpensesByCategory] = useState<ExpenseByCategory[]>([]);
  const [monthlyExpenses, setMonthlyExpenses] = useState<MonthlyExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(new Date(new Date().getFullYear(), 0, 1));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [branchExpenses, setBranchExpenses] = useState<BranchExpense[]>([]);
  const [fleetKilometers, setFleetKilometers] = useState<FleetKilometers>({ totalKm: 0, byBranch: [], byVehicle: [] });
  const { toast } = useToast();

  useEffect(() => {
    fetchBranchesAndVehicles();
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [selectedBranch, selectedVehicle, startDate, endDate]);

  useEffect(() => {
    if (selectedBranch === 'all') {
      setFilteredVehicles(vehicles);
    } else {
      setFilteredVehicles(vehicles.filter(v => v.branch_id === selectedBranch));
    }
    // Reset vehicle selection when branch changes
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
      supabase.from('vehicles').select('id, plate, make, model, branch_id, odometer_km').order('plate')
    ]);

    if (branchesRes.data) setBranches(branchesRes.data);
    if (vehiclesRes.data) {
      setVehicles(vehiclesRes.data);
      setFilteredVehicles(vehiclesRes.data);
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    const dateStart = startDate ? format(startDate, 'yyyy-MM-dd') : `${new Date().getFullYear()}-01-01`;
    const dateEnd = endDate ? format(endDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

    // Build query with filters
    let query = supabase
      .from('expenses')
      .select(`
        amount,
        vehicle_id,
        expense_categories (
          name,
          type
        ),
        vehicles!inner (
          branch_id
        )
      `)
      .gte('date', dateStart)
      .lte('date', dateEnd);

    if (selectedBranch !== 'all') {
      query = query.eq('vehicles.branch_id', selectedBranch);
    }

    if (selectedVehicle !== 'all') {
      query = query.eq('vehicle_id', selectedVehicle);
    }

    const { data: expenses } = await query;

    if (expenses) {
      const categoryMap = new Map<string, { amount: number; type: string }>();
      expenses.forEach((exp: any) => {
        const categoryName = exp.expense_categories?.name || 'Uncategorized';
        const type = exp.expense_categories?.type || 'other';
        const current = categoryMap.get(categoryName) || { amount: 0, type };
        categoryMap.set(categoryName, {
          amount: current.amount + Number(exp.amount),
          type,
        });
      });

      const categoryData = Array.from(categoryMap.entries()).map(([category, data]) => ({
        category,
        amount: data.amount,
        type: data.type,
      }));
      setExpensesByCategory(categoryData);
    } else {
      setExpensesByCategory([]);
    }

    // Fetch monthly expenses with filters
    let monthlyQuery = supabase
      .from('expenses')
      .select(`
        amount, 
        date,
        vehicle_id,
        vehicles!inner (branch_id)
      `)
      .gte('date', dateStart)
      .lte('date', dateEnd)
      .order('date');

    if (selectedBranch !== 'all') {
      monthlyQuery = monthlyQuery.eq('vehicles.branch_id', selectedBranch);
    }

    if (selectedVehicle !== 'all') {
      monthlyQuery = monthlyQuery.eq('vehicle_id', selectedVehicle);
    }

    const { data: monthlyData } = await monthlyQuery;

    if (monthlyData) {
      const monthlyMap = new Map<string, number>();
      monthlyData.forEach((exp: any) => {
        const month = new Date(exp.date).toLocaleDateString('en-US', { month: 'short' });
        monthlyMap.set(month, (monthlyMap.get(month) || 0) + Number(exp.amount));
      });

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlyChartData = months.map(month => ({
        month,
        amount: monthlyMap.get(month) || 0,
      }));
      setMonthlyExpenses(monthlyChartData);
    } else {
      setMonthlyExpenses([]);
    }

    // Fetch branch breakdown (only when not filtering by specific branch/vehicle)
    if (selectedBranch === 'all' && selectedVehicle === 'all') {
      const { data: branchData } = await supabase
        .from('expenses')
        .select(`
          amount,
          vehicle_id,
          vehicles!inner (
            branch_id,
            branches (
              id,
              name
            )
          )
        `)
        .gte('date', dateStart)
        .lte('date', dateEnd);

      if (branchData) {
        const branchMap = new Map<string, { name: string; amount: number; vehicles: Set<string>; count: number }>();
        
        branchData.forEach((exp: any) => {
          const branchId = exp.vehicles?.branch_id || 'unassigned';
          const branchName = exp.vehicles?.branches?.name || 'Unassigned';
          const current = branchMap.get(branchId) || { name: branchName, amount: 0, vehicles: new Set<string>(), count: 0 };
          current.amount += Number(exp.amount);
          current.vehicles.add(exp.vehicle_id);
          current.count += 1;
          branchMap.set(branchId, current);
        });

        const branchBreakdown = Array.from(branchMap.entries())
          .map(([branchId, data]) => ({
            branchId,
            branchName: data.name,
            totalAmount: data.amount,
            vehicleCount: data.vehicles.size,
            expenseCount: data.count,
          }))
          .sort((a, b) => b.totalAmount - a.totalAmount);

        setBranchExpenses(branchBreakdown);
      } else {
        setBranchExpenses([]);
      }
    } else {
      setBranchExpenses([]);
    }

    // Fetch fleet kilometers data
    await fetchFleetKilometers();

    setLoading(false);
  };

  const fetchFleetKilometers = async () => {
    // Get all vehicles with their odometer and branch info
    let vehiclesQuery = supabase
      .from('vehicles')
      .select(`
        id,
        plate,
        make,
        model,
        odometer_km,
        branch_id,
        branches (
          id,
          name
        )
      `);

    if (selectedBranch !== 'all') {
      vehiclesQuery = vehiclesQuery.eq('branch_id', selectedBranch);
    }

    if (selectedVehicle !== 'all') {
      vehiclesQuery = vehiclesQuery.eq('id', selectedVehicle);
    }

    const { data: vehiclesData } = await vehiclesQuery;

    if (vehiclesData) {
      // Calculate totals
      let totalKm = 0;
      const branchMap = new Map<string, { name: string; km: number; vehicles: Set<string> }>();
      const vehicleKmList: FleetKilometers['byVehicle'] = [];

      vehiclesData.forEach((v: any) => {
        const km = v.odometer_km || 0;
        totalKm += km;

        // By branch
        const branchId = v.branch_id || 'unassigned';
        const branchName = v.branches?.name || 'Unassigned';
        const current = branchMap.get(branchId) || { name: branchName, km: 0, vehicles: new Set<string>() };
        current.km += km;
        current.vehicles.add(v.id);
        branchMap.set(branchId, current);

        // By vehicle
        vehicleKmList.push({
          vehicleId: v.id,
          plate: v.plate,
          make: v.make,
          model: v.model,
          branchName: branchName,
          kilometers: km,
        });
      });

      const byBranch = Array.from(branchMap.entries())
        .map(([branchId, data]) => ({
          branchId,
          branchName: data.name,
          kilometers: data.km,
          vehicleCount: data.vehicles.size,
        }))
        .sort((a, b) => b.kilometers - a.kilometers);

      const byVehicle = vehicleKmList.sort((a, b) => b.kilometers - a.kilometers);

      setFleetKilometers({ totalKm, byBranch, byVehicle });
    } else {
      setFleetKilometers({ totalKm: 0, byBranch: [], byVehicle: [] });
    }
  };

  const exportToCSV = async () => {
    try {
      let query = supabase
        .from('expenses')
        .select(`
          date,
          amount,
          description,
          odometer_reading,
          vehicle_id,
          vehicles!inner (plate, make, model, branch_id),
          expense_categories (name, type)
        `)
        .order('date', { ascending: false });

      if (selectedBranch !== 'all') {
        query = query.eq('vehicles.branch_id', selectedBranch);
      }

      if (selectedVehicle !== 'all') {
        query = query.eq('vehicle_id', selectedVehicle);
      }

      const { data: expenses } = await query;

      if (!expenses) return;

      const headers = ['Date', 'Vehicle', 'Category', 'Type', 'Amount', 'Odometer', 'Description'];
      const rows = expenses.map((exp: any) => [
        exp.date,
        `${exp.vehicles?.make || ''} ${exp.vehicles?.model || ''} (${exp.vehicles?.plate || 'N/A'})`,
        exp.expense_categories?.name || 'Uncategorized',
        exp.expense_categories?.type || 'N/A',
        exp.amount,
        exp.odometer_reading || '',
        exp.description || '',
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fleet-expenses-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();

      toast({
        title: 'Success',
        description: 'Report exported as CSV',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export CSV',
        variant: 'destructive',
      });
    }
  };

  const exportToPDF = async () => {
    try {
      const reportElement = document.getElementById('reports-container');
      if (!reportElement) return;

      const canvas = await html2canvas(reportElement, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`fleet-report-${new Date().toISOString().split('T')[0]}.pdf`);

      toast({
        title: 'Success',
        description: 'Report exported as PDF',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export PDF',
        variant: 'destructive',
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const getFilterLabel = () => {
    const parts = [];
    if (selectedBranch !== 'all') {
      const branch = branches.find(b => b.id === selectedBranch);
      if (branch) parts.push(branch.name);
    }
    if (selectedVehicle !== 'all') {
      const vehicle = vehicles.find(v => v.id === selectedVehicle);
      if (vehicle) parts.push(`${vehicle.make || ''} ${vehicle.model || ''} (${vehicle.plate})`);
    }
    return parts.length > 0 ? parts.join(' - ') : 'All Fleet';
  };

  const getDateRangeLabel = () => {
    if (startDate && endDate) {
      return `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`;
    }
    return 'Current Year';
  };

  if (loading && branches.length === 0) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Loading reports...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Fleet Reports</h1>
            <p className="text-muted-foreground">Analytics and insights for your fleet</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportToCSV} variant="outline" className="gap-2">
              <FileDown className="h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={exportToPDF} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export PDF
            </Button>
          </div>
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
                        className={cn(
                          "w-full justify-start text-left font-normal bg-background",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : <span>Pick start date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">End Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal bg-background",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : <span>Pick end date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t">
              <p className="text-sm text-muted-foreground">
                Showing data for: <span className="font-medium text-foreground">{getFilterLabel()}</span>
                {' • '}
                <span className="font-medium text-foreground">{getDateRangeLabel()}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <div id="reports-container" className="space-y-6 bg-background p-6 rounded-lg">
          {loading ? (
            <div className="flex items-center justify-center min-h-[300px]">
              <p className="text-muted-foreground">Loading data...</p>
            </div>
          ) : (
            <>
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Monthly Expense Trend
                  </CardTitle>
                  <CardDescription>Total expenses by month ({getDateRangeLabel()}) - {getFilterLabel()}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={monthlyExpenses}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Legend />
                      <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} name="Expenses" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-6">
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle>Expenses by Category</CardTitle>
                    <CardDescription>Breakdown of expenses by type</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {expensesByCategory.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={expensesByCategory}
                            dataKey="amount"
                            nameKey="category"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={(entry) => entry.category}
                          >
                            {expensesByCategory.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                        No expense data for selected filters
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle>Category Comparison</CardTitle>
                    <CardDescription>Maintenance vs Repairs</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {expensesByCategory.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={expensesByCategory}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} />
                          <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
                          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                          <Bar dataKey="amount" fill="hsl(var(--secondary))" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                        No expense data for selected filters
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Summary Statistics</CardTitle>
                  <CardDescription>{getFilterLabel()}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-4 gap-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Categories</p>
                      <p className="text-2xl font-bold">{expensesByCategory.length}</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Spent</p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(expensesByCategory.reduce((sum, cat) => sum + cat.amount, 0))}
                      </p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Avg Monthly</p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(monthlyExpenses.reduce((sum, m) => sum + m.amount, 0) / Math.max(monthlyExpenses.filter(m => m.amount > 0).length, 1))}
                      </p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Fleet Kilometers</p>
                      <p className="text-2xl font-bold">{fleetKilometers.totalKm.toLocaleString()} km</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Fleet Kilometers by Branch */}
              {fleetKilometers.byBranch.length > 0 && selectedVehicle === 'all' && (
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Navigation className="h-5 w-5 text-primary" />
                      Fleet Kilometers by Branch
                    </CardTitle>
                    <CardDescription>Total odometer readings across the fleet</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Branch</TableHead>
                          <TableHead className="text-right">Vehicles</TableHead>
                          <TableHead className="text-right">Total Kilometers</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fleetKilometers.byBranch.map((branch) => (
                          <TableRow key={branch.branchId}>
                            <TableCell className="font-medium">{branch.branchName}</TableCell>
                            <TableCell className="text-right">{branch.vehicleCount}</TableCell>
                            <TableCell className="text-right font-semibold">{branch.kilometers.toLocaleString()} km</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter>
                        <TableRow>
                          <TableCell className="font-bold">Total</TableCell>
                          <TableCell className="text-right font-bold">
                            {fleetKilometers.byBranch.reduce((sum, b) => sum + b.vehicleCount, 0)}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {fleetKilometers.totalKm.toLocaleString()} km
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Fleet Kilometers by Vehicle (when filtered or detailed view) */}
              {fleetKilometers.byVehicle.length > 0 && fleetKilometers.byVehicle.length <= 20 && (
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Navigation className="h-5 w-5 text-primary" />
                      Kilometers by Vehicle
                    </CardTitle>
                    <CardDescription>Individual vehicle odometer readings</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Vehicle</TableHead>
                          <TableHead>Branch</TableHead>
                          <TableHead className="text-right">Kilometers</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fleetKilometers.byVehicle.map((vehicle) => (
                          <TableRow key={vehicle.vehicleId}>
                            <TableCell className="font-medium">
                              {vehicle.make} {vehicle.model} ({vehicle.plate})
                            </TableCell>
                            <TableCell>{vehicle.branchName}</TableCell>
                            <TableCell className="text-right font-semibold">{vehicle.kilometers.toLocaleString()} km</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {branchExpenses.length > 0 && (
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      Expense Breakdown by Branch
                    </CardTitle>
                    <CardDescription>Detailed view of expenses across all branches</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Branch</TableHead>
                          <TableHead className="text-right">Vehicles</TableHead>
                          <TableHead className="text-right">Expenses</TableHead>
                          <TableHead className="text-right">Total Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {branchExpenses.map((branch) => (
                          <TableRow key={branch.branchId}>
                            <TableCell className="font-medium">{branch.branchName}</TableCell>
                            <TableCell className="text-right">{branch.vehicleCount}</TableCell>
                            <TableCell className="text-right">{branch.expenseCount}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(branch.totalAmount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter>
                        <TableRow>
                          <TableCell className="font-bold">Total</TableCell>
                          <TableCell className="text-right font-bold">
                            {branchExpenses.reduce((sum, b) => sum + b.vehicleCount, 0)}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {branchExpenses.reduce((sum, b) => sum + b.expenseCount, 0)}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(branchExpenses.reduce((sum, b) => sum + b.totalAmount, 0))}
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* GPS Mileage Report */}
              <GPSReportSection />

              {/* Vehicle Inspection Reports */}
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-primary" />
                    Vehicle Inspection Reports
                  </CardTitle>
                  <CardDescription>Monthly vehicle inspections and actionable items</CardDescription>
                </CardHeader>
                <CardContent>
                  <InspectionReports />
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}