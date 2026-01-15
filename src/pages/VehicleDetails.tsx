import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { AddExpenseDialog } from '@/components/AddExpenseDialog';
import { EditVehicleDialog } from '@/components/EditVehicleDialog';
import { EditExpenseDialog } from '@/components/EditExpenseDialog';

import { ArrowLeft, MapPin, Calendar, Gauge, FileText, Download, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Vehicle {
  id: string;
  vin: string;
  plate: string;
  make: string | null;
  model: string | null;
  year: number | null;
  odometer_km: number;
  last_oil_change_km: number | null;
  last_tire_change_date: string | null;
  status: string;
  notes: string | null;
  branch_id: string | null;
  transponder_407: string | null;
  branches: { name: string; location: string | null } | null;
}

interface Expense {
  id: string;
  amount: number;
  date: string;
  description: string | null;
  odometer_reading: number | null;
  approval_status: string;
  vehicle_id: string;
  category_id: string | null;
  branch_id: string | null;
  rejection_reason: string | null;
  vendor_name: string | null;
  staff_name: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  expense_categories: { name: string; type: string } | null;
  documents: { id: string; file_name: string; file_path: string }[];
}

export default function VehicleDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const { toast } = useToast();
  const { isAdminOrManager } = useUserRole();

  useEffect(() => {
    if (id) {
      fetchVehicleDetails();
      fetchExpenses();
    }
  }, [id]);

  const fetchVehicleDetails = async () => {
    const { data, error } = await supabase
      .from('vehicles')
      .select(`
        *,
        branches (
          name,
          location
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      toast({
        title: 'Error',
        description: 'Vehicle not found',
        variant: 'destructive',
      });
      navigate('/');
      return;
    }

    setVehicle(data);
    setLoading(false);
  };

  const fetchExpenses = async () => {
    const { data } = await supabase
      .from('expenses')
      .select(`
        *,
        expense_categories (
          name,
          type
        ),
        documents (
          id,
          file_name,
          file_path
        )
      `)
      .eq('vehicle_id', id)
      .is('deleted_at', null)
      .order('date', { ascending: false });

    if (data) {
      setExpenses(data);
    }
  };

  const downloadDocument = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from('vehicle-documents')
      .download(filePath);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to download document',
        variant: 'destructive',
      });
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-secondary text-secondary-foreground';
      case 'maintenance':
        return 'bg-accent text-accent-foreground';
      case 'retired':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Loading vehicle details...</p>
        </div>
      </Layout>
    );
  }

  if (!vehicle) return null;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">
              {vehicle.make && vehicle.model ? `${vehicle.make} ${vehicle.model}` : vehicle.plate}
            </h1>
            <p className="text-muted-foreground">VIN: {vehicle.vin}</p>
          </div>
          <div className="flex items-center gap-2">
            {isAdminOrManager && (
              <EditVehicleDialog vehicle={vehicle} onVehicleUpdated={fetchVehicleDetails} />
            )}
            <Badge className={getStatusColor(vehicle.status)}>{vehicle.status}</Badge>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Vehicle Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">License Plate</p>
                <p className="font-semibold">{vehicle.plate}</p>
              </div>
              {vehicle.year && (
                <div>
                  <p className="text-muted-foreground">Year</p>
                  <p className="font-semibold">{vehicle.year}</p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Odometer</p>
                  <p className="font-semibold">{vehicle.odometer_km.toLocaleString()} km</p>
                </div>
              </div>
              {vehicle.branches && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Branch</p>
                    <p className="font-semibold">{vehicle.branches.name}</p>
                    {vehicle.branches.location && (
                      <p className="text-xs text-muted-foreground">{vehicle.branches.location}</p>
                    )}
                  </div>
                </div>
              )}
              {vehicle.transponder_407 && (
                <div>
                  <p className="text-muted-foreground">407 Transponder</p>
                  <p className="font-semibold font-mono">{vehicle.transponder_407}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Maintenance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {vehicle.last_oil_change_km && (
                <div>
                  <p className="text-muted-foreground">Last Oil Change</p>
                  <p className="font-semibold">{vehicle.last_oil_change_km.toLocaleString()} km</p>
                  <p className="text-xs text-muted-foreground">
                    {(vehicle.odometer_km - vehicle.last_oil_change_km).toLocaleString()} km ago
                  </p>
                </div>
              )}
              {vehicle.last_tire_change_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Last Tire Change</p>
                    <p className="font-semibold">
                      {new Date(vehicle.last_tire_change_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}
              {vehicle.notes && (
                <div>
                  <p className="text-muted-foreground">Notes</p>
                  <p className="text-xs">{vehicle.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Expense Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totalExpenses)}</p>
                <p className="text-xs text-muted-foreground">Total lifetime expenses</p>
              </div>
              <div>
                <p className="text-lg font-semibold">{expenses.length}</p>
                <p className="text-xs text-muted-foreground">Total transactions</p>
              </div>
              {expenses.filter(e => e.approval_status === 'pending').length > 0 && (
                <div>
                  <p className="text-lg font-semibold text-orange-600">
                    {expenses.filter(e => e.approval_status === 'pending').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Pending approval</p>
                </div>
              )}
              <AddExpenseDialog vehicleId={vehicle.id} onExpenseAdded={fetchExpenses} />
            </CardContent>
          </Card>
        </div>

        

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Expense History</CardTitle>
          </CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No expenses recorded yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {expenses.map((expense) => (
                  <div key={expense.id} className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold">{expense.expense_categories?.name || 'Uncategorized'}</p>
                        <Badge variant="outline" className="text-xs">
                          {expense.expense_categories?.type || 'other'}
                        </Badge>
                        {expense.approval_status === 'pending' && (
                          <Badge variant="secondary" className="text-xs">
                            Pending Approval
                          </Badge>
                        )}
                        {expense.approval_status === 'rejected' && (
                          <Badge variant="destructive" className="text-xs">
                            Rejected
                          </Badge>
                        )}
                        {expense.approval_status === 'approved' && (
                          <Badge variant="default" className="text-xs">
                            Approved
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {new Date(expense.date).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                      {expense.description && (
                        <p className="text-sm mb-2">{expense.description}</p>
                      )}
                      {expense.odometer_reading && (
                        <p className="text-xs text-muted-foreground">
                          Odometer: {expense.odometer_reading.toLocaleString()} km
                        </p>
                      )}
                      {expense.documents.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {expense.documents.map((doc) => (
                            <Button
                              key={doc.id}
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-xs"
                              onClick={() => downloadDocument(doc.file_path, doc.file_name)}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              {doc.file_name}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditExpense(expense);
                          setShowEditDialog(true);
                        }}
                        title="Edit expense"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <p className="text-lg font-bold">{formatCurrency(Number(expense.amount))}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <EditExpenseDialog
          expense={editExpense}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onExpenseUpdated={fetchExpenses}
        />
      </div>
    </Layout>
  );
}
