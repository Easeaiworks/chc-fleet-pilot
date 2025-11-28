import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, FileDown, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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

const COLORS = ['hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--primary))', 'hsl(var(--destructive))', '#8884d8', '#82ca9d'];

export default function Reports() {
  const [expensesByCategory, setExpensesByCategory] = useState<ExpenseByCategory[]>([]);
  const [monthlyExpenses, setMonthlyExpenses] = useState<MonthlyExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    const currentYear = new Date().getFullYear();

    // Fetch expenses by category
    const { data: expenses } = await supabase
      .from('expenses')
      .select(`
        amount,
        expense_categories (
          name,
          type
        )
      `)
      .gte('date', `${currentYear}-01-01`);

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
    }

    // Fetch monthly expenses for current year
    const { data: monthlyData } = await supabase
      .from('expenses')
      .select('amount, date')
      .gte('date', `${currentYear}-01-01`)
      .order('date');

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
    }

    setLoading(false);
  };

  const exportToCSV = async () => {
    try {
      const { data: expenses } = await supabase
        .from('expenses')
        .select(`
          date,
          amount,
          description,
          odometer_reading,
          vehicles (plate, make, model),
          expense_categories (name, type)
        `)
        .order('date', { ascending: false });

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

  if (loading) {
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
        <div className="flex items-center justify-between">
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

        <div id="reports-container" className="space-y-6 bg-background p-6 rounded-lg">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Monthly Expense Trend
              </CardTitle>
              <CardDescription>Total expenses by month (Current Year)</CardDescription>
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
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Category Comparison</CardTitle>
                <CardDescription>Maintenance vs Repairs</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={expensesByCategory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} />
                    <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="amount" fill="hsl(var(--secondary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Summary Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Categories</p>
                  <p className="text-2xl font-bold">{expensesByCategory.length}</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Spent (YTD)</p>
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
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
