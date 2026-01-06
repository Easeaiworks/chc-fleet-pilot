import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Clock, DollarSign, Car, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { EditExpenseDialog } from '@/components/EditExpenseDialog';

interface RecentExpense {
  id: string;
  amount: number;
  date: string;
  description: string | null;
  approval_status: string | null;
  created_at: string;
  vehicle_id: string;
  category_id: string | null;
  rejection_reason: string | null;
  vendor_name: string | null;
  staff_name: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  odometer_reading: number | null;
  vehicle: {
    id: string;
    plate: string;
    make: string | null;
    model: string | null;
  } | null;
  category: {
    name: string;
  } | null;
  creator: {
    full_name: string | null;
    email: string;
  } | null;
}

export function RecentExpensesFeed() {
  const [expenses, setExpenses] = useState<RecentExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [editExpense, setEditExpense] = useState<RecentExpense | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRecentExpenses();
  }, []);

  const fetchRecentExpenses = async () => {
    const { data, error } = await supabase
      .from('expenses')
      .select(`
        id,
        amount,
        date,
        description,
        approval_status,
        created_at,
        vehicle_id,
        category_id,
        rejection_reason,
        vendor_name,
        staff_name,
        subtotal,
        tax_amount,
        odometer_reading,
        vehicle:vehicles (
          id,
          plate,
          make,
          model
        ),
        category:expense_categories (
          name
        ),
        creator:profiles!expenses_created_by_fkey (
          full_name,
          email
        )
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      setExpenses(data as unknown as RecentExpense[]);
    }
    setLoading(false);
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'approved':
        return 'bg-secondary text-secondary-foreground';
      case 'rejected':
        return 'bg-destructive text-destructive-foreground';
      case 'pending':
      default:
        return 'bg-accent text-accent-foreground';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-6 text-center text-muted-foreground">
          Loading recent expenses...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Recent Activity
        </CardTitle>
        <CardDescription>Latest 10 expense entries</CardDescription>
      </CardHeader>
      <CardContent>
        {expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No expense entries yet
          </p>
        ) : (
          <div className="space-y-3">
            {expenses.map((expense) => (
              <div
                key={expense.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div 
                  className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  onClick={() => expense.vehicle && navigate(`/vehicles/${expense.vehicle.id}`)}
                >
                  <div className="p-2 rounded-full bg-primary/10">
                    <DollarSign className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">
                        {formatCurrency(expense.amount)}
                      </p>
                      {expense.category && (
                        <span className="text-xs text-muted-foreground">
                          • {expense.category.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {expense.vehicle && (
                        <span className="flex items-center gap-1">
                          <Car className="h-3 w-3" />
                          {expense.vehicle.make && expense.vehicle.model
                            ? `${expense.vehicle.make} ${expense.vehicle.model}`
                            : expense.vehicle.plate}
                        </span>
                      )}
                      <span>• {format(new Date(expense.date), 'MMM d, yyyy')}</span>
                    </div>
                    {expense.creator && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        by {expense.creator.full_name || expense.creator.email}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditExpense(expense);
                      setShowEditDialog(true);
                    }}
                    title="Edit expense"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Badge className={`${getStatusColor(expense.approval_status)} text-xs`}>
                    {expense.approval_status || 'pending'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        <EditExpenseDialog
          expense={editExpense}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onExpenseUpdated={fetchRecentExpenses}
        />
      </CardContent>
    </Card>
  );
}
