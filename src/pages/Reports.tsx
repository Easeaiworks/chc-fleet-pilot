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
import { Download, FileDown, TrendingUp, Filter, CalendarIcon, Building2, Navigation, AlertTriangle, Receipt } from 'lucide-react';
import { GPSReportSection } from '@/components/GPSReportSection';
import { InspectionReports } from '@/components/InspectionReports';
import { ReceiptHistory } from '@/components/ReceiptHistory';
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

    // Build query with filters - exclude rejected expenses from reports
    let query = supabase
      .from('expenses')
      .select(`
        amount,
        vehicle_id,
        approval_status,
        expense_categories (
          name,
          type
        ),
        vehicles!inner (
          branch_id
        )
      `)
      .neq('approval_status', 'rejected')
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

    // Fetch monthly expenses with filters - exclude rejected
    let monthlyQuery = supabase
      .from('expenses')
      .select(`
        amount, 
        date,
        vehicle_id,
        vehicles!inner (branch_id)
      `)
      .neq('approval_status', 'rejected')
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
        .neq('approval_status', 'rejected')
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
      // Fetch expenses
      let expenseQuery = supabase
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
        expenseQuery = expenseQuery.eq('vehicles.branch_id', selectedBranch);
      }

      if (selectedVehicle !== 'all') {
        expenseQuery = expenseQuery.eq('vehicle_id', selectedVehicle);
      }

      // Fetch GPS data
      const { data: gpsData } = await supabase
        .from('gps_uploads')
        .select(`
          upload_month,
          kilometers,
          gps_vehicle_name,
          file_name,
          vehicle_id,
          vehicles (plate, make, model)
        `)
        .order('upload_month', { ascending: false });

      // Fetch Inspections
      let inspectionQuery = supabase
        .from('vehicle_inspections')
        .select(`
          inspection_date,
          kilometers,
          brakes_pass, brakes_notes,
          engine_pass, engine_notes,
          transmission_pass, transmission_notes,
          tires_pass, tires_notes,
          headlights_pass, headlights_notes,
          signal_lights_pass, signal_lights_notes,
          oil_level_pass, oil_level_notes,
          windshield_fluid_pass, windshield_fluid_notes,
          wipers_pass, wipers_notes,
          vehicles (plate, make, model),
          branches (name)
        `)
        .order('inspection_date', { ascending: false });

      const [expensesRes, inspectionsRes] = await Promise.all([
        expenseQuery,
        inspectionQuery
      ]);

      const expenses = expensesRes.data || [];
      const inspections = inspectionsRes.data || [];

      // Build CSV with multiple sections
      let csvContent = '';
      
      // Section 1: Expenses
      csvContent += '=== EXPENSES REPORT ===\n';
      const expenseHeaders = ['Date', 'Vehicle', 'Category', 'Type', 'Amount', 'Odometer', 'Description'];
      csvContent += expenseHeaders.join(',') + '\n';
      expenses.forEach((exp: any) => {
        const row = [
          exp.date,
          `${exp.vehicles?.make || ''} ${exp.vehicles?.model || ''} (${exp.vehicles?.plate || 'N/A'})`,
          exp.expense_categories?.name || 'Uncategorized',
          exp.expense_categories?.type || 'N/A',
          exp.amount,
          exp.odometer_reading || '',
          exp.description || '',
        ];
        csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
      });

      // Section 2: GPS Data
      csvContent += '\n=== GPS MILEAGE REPORT ===\n';
      const gpsHeaders = ['Month', 'Vehicle', 'GPS Name', 'Kilometers', 'File'];
      csvContent += gpsHeaders.join(',') + '\n';
      (gpsData || []).forEach((gps: any) => {
        const row = [
          gps.upload_month,
          gps.vehicles ? `${gps.vehicles.make || ''} ${gps.vehicles.model || ''} (${gps.vehicles.plate})` : 'Unmatched',
          gps.gps_vehicle_name || '',
          gps.kilometers,
          gps.file_name,
        ];
        csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
      });

      // Section 3: Inspections
      csvContent += '\n=== VEHICLE INSPECTIONS REPORT ===\n';
      const inspectionHeaders = ['Date', 'Vehicle', 'Location', 'Kilometers', 'Brakes', 'Engine', 'Transmission', 'Tires', 'Headlights', 'Signal Lights', 'Oil Level', 'Windshield Fluid', 'Wipers', 'Failed Items Notes'];
      csvContent += inspectionHeaders.join(',') + '\n';
      inspections.forEach((insp: any) => {
        const failedNotes: string[] = [];
        if (!insp.brakes_pass && insp.brakes_notes) failedNotes.push(`Brakes: ${insp.brakes_notes}`);
        if (!insp.engine_pass && insp.engine_notes) failedNotes.push(`Engine: ${insp.engine_notes}`);
        if (!insp.transmission_pass && insp.transmission_notes) failedNotes.push(`Transmission: ${insp.transmission_notes}`);
        if (!insp.tires_pass && insp.tires_notes) failedNotes.push(`Tires: ${insp.tires_notes}`);
        if (!insp.headlights_pass && insp.headlights_notes) failedNotes.push(`Headlights: ${insp.headlights_notes}`);
        if (!insp.signal_lights_pass && insp.signal_lights_notes) failedNotes.push(`Signal Lights: ${insp.signal_lights_notes}`);
        if (!insp.oil_level_pass && insp.oil_level_notes) failedNotes.push(`Oil Level: ${insp.oil_level_notes}`);
        if (!insp.windshield_fluid_pass && insp.windshield_fluid_notes) failedNotes.push(`Windshield Fluid: ${insp.windshield_fluid_notes}`);
        if (!insp.wipers_pass && insp.wipers_notes) failedNotes.push(`Wipers: ${insp.wipers_notes}`);

        const row = [
          insp.inspection_date,
          insp.vehicles ? `${insp.vehicles.make || ''} ${insp.vehicles.model || ''} (${insp.vehicles.plate})` : 'N/A',
          insp.branches?.name || 'N/A',
          insp.kilometers || '',
          insp.brakes_pass ? 'Pass' : 'Fail',
          insp.engine_pass ? 'Pass' : 'Fail',
          insp.transmission_pass ? 'Pass' : 'Fail',
          insp.tires_pass ? 'Pass' : 'Fail',
          insp.headlights_pass ? 'Pass' : 'Fail',
          insp.signal_lights_pass ? 'Pass' : 'Fail',
          insp.oil_level_pass ? 'Pass' : 'Fail',
          insp.windshield_fluid_pass ? 'Pass' : 'Fail',
          insp.wipers_pass ? 'Pass' : 'Fail',
          failedNotes.join(' | '),
        ];
        csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
      });

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fleet-complete-report-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();

      toast({
        title: 'Success',
        description: 'Complete report exported as CSV (Expenses, GPS, Inspections)',
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

      toast({
        title: 'Generating PDF',
        description: 'Please wait while the report is being generated...',
      });

      const canvas = await html2canvas(reportElement, { 
        scale: 2,
        useCORS: true,
        logging: false,
        windowHeight: reportElement.scrollHeight,
        height: reportElement.scrollHeight,
      });
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfPageHeight;

      // Add additional pages if content is longer than one page
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfPageHeight;
      }

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
                    <CardDescription>Maintenance vs Repairs vs Vehicle Purchase</CardDescription>
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

              {/* Expense Type Breakdown */}
              <div className="grid md:grid-cols-3 gap-4">
                {(() => {
                  const maintenanceTotal = expensesByCategory.filter(c => c.type === 'maintenance').reduce((sum, c) => sum + c.amount, 0);
                  const repairTotal = expensesByCategory.filter(c => c.type === 'repair').reduce((sum, c) => sum + c.amount, 0);
                  const purchaseTotal = expensesByCategory.filter(c => c.type === 'purchase').reduce((sum, c) => sum + c.amount, 0);
                  
                  return (
                    <>
                      <Card className="shadow-card border-l-4 border-l-secondary">
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-secondary/20 rounded-lg">
                              <Receipt className="h-6 w-6 text-secondary" />
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Maintenance</p>
                              <p className="text-2xl font-bold">{formatCurrency(maintenanceTotal)}</p>
                              <p className="text-xs text-muted-foreground">
                                {expensesByCategory.filter(c => c.type === 'maintenance').length} categories
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="shadow-card border-l-4 border-l-accent">
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-accent/20 rounded-lg">
                              <AlertTriangle className="h-6 w-6 text-amber-600" />
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Repairs</p>
                              <p className="text-2xl font-bold">{formatCurrency(repairTotal)}</p>
                              <p className="text-xs text-muted-foreground">
                                {expensesByCategory.filter(c => c.type === 'repair').length} categories
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="shadow-card border-l-4 border-l-primary">
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <Building2 className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Vehicle Purchase</p>
                              <p className="text-2xl font-bold">{formatCurrency(purchaseTotal)}</p>
                              <p className="text-xs text-muted-foreground">
                                {expensesByCategory.filter(c => c.type === 'purchase').length} categories
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  );
                })()}

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

              {/* Receipt History for Accounting */}
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
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}