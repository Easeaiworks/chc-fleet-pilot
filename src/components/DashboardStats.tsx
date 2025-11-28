import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Car, DollarSign, Calendar, TrendingUp } from 'lucide-react';

interface StatsData {
  totalVehicles: number;
  monthlyExpenses: number;
  yearlyExpenses: number;
  totalExpenses: number;
}

export function DashboardStats() {
  const [stats, setStats] = useState<StatsData>({
    totalVehicles: 0,
    monthlyExpenses: 0,
    yearlyExpenses: 0,
    totalExpenses: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Get total vehicles
    const { count: vehicleCount } = await supabase
      .from('vehicles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Get monthly expenses
    const { data: monthlyData } = await supabase
      .from('expenses')
      .select('amount')
      .gte('date', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`)
      .lt('date', `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`);

    // Get yearly expenses
    const { data: yearlyData } = await supabase
      .from('expenses')
      .select('amount')
      .gte('date', `${currentYear}-01-01`)
      .lt('date', `${currentYear + 1}-01-01`);

    // Get total expenses
    const { data: totalData } = await supabase
      .from('expenses')
      .select('amount');

    const monthlySum = monthlyData?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;
    const yearlySum = yearlyData?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;
    const totalSum = totalData?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;

    setStats({
      totalVehicles: vehicleCount || 0,
      monthlyExpenses: monthlySum,
      yearlyExpenses: yearlySum,
      totalExpenses: totalSum,
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="shadow-card hover:shadow-elevated transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Vehicles</CardTitle>
          <Car className="h-4 w-4 text-secondary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalVehicles}</div>
          <p className="text-xs text-muted-foreground">Active fleet</p>
        </CardContent>
      </Card>
      
      <Card className="shadow-card hover:shadow-elevated transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Month</CardTitle>
          <Calendar className="h-4 w-4 text-accent" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(stats.monthlyExpenses)}</div>
          <p className="text-xs text-muted-foreground">Current month expenses</p>
        </CardContent>
      </Card>
      
      <Card className="shadow-card hover:shadow-elevated transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Year</CardTitle>
          <TrendingUp className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(stats.yearlyExpenses)}</div>
          <p className="text-xs text-muted-foreground">Year to date</p>
        </CardContent>
      </Card>
      
      <Card className="shadow-card hover:shadow-elevated transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">All Time</CardTitle>
          <DollarSign className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(stats.totalExpenses)}</div>
          <p className="text-xs text-muted-foreground">Total fleet costs</p>
        </CardContent>
      </Card>
    </div>
  );
}
