import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Gauge } from 'lucide-react';
import { AddVehicleDialog } from './AddVehicleDialog';
import { AddVehiclePurchaseDialog } from './AddVehiclePurchaseDialog';

interface Vehicle {
  id: string;
  vin: string;
  plate: string;
  make: string | null;
  model: string | null;
  year: number | null;
  odometer_km: number;
  status: string;
  branches: { name: string } | null;
}

export function VehicleList() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { isAdminOrManager } = useUserRole();

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    const { data, error } = await supabase
      .from('vehicles')
      .select(`
        *,
        branches (
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setVehicles(data);
    }
    setLoading(false);
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

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading vehicles...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Fleet Vehicles</h2>
          <p className="text-muted-foreground">Manage and track your vehicle fleet</p>
        </div>
        {isAdminOrManager && (
          <div className="flex gap-2">
            <AddVehiclePurchaseDialog onVehicleAdded={fetchVehicles} />
            <AddVehicleDialog onVehicleAdded={fetchVehicles} />
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {vehicles.map((vehicle) => (
          <Card 
            key={vehicle.id} 
            className="shadow-card hover:shadow-elevated transition-all duration-300 cursor-pointer"
            onClick={() => navigate(`/vehicles/${vehicle.id}`)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">
                    {vehicle.make && vehicle.model 
                      ? `${vehicle.make} ${vehicle.model}` 
                      : vehicle.plate}
                  </CardTitle>
                  <CardDescription className="font-mono text-xs">
                    VIN: {vehicle.vin}
                  </CardDescription>
                </div>
                <Badge className={getStatusColor(vehicle.status)}>
                  {vehicle.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{vehicle.branches?.name || 'No branch assigned'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Gauge className="h-4 w-4 text-muted-foreground" />
                <span>{vehicle.odometer_km.toLocaleString()} km</span>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  Plate: <span className="font-semibold text-foreground">{vehicle.plate}</span>
                </p>
                {vehicle.year && (
                  <p className="text-xs text-muted-foreground">
                    Year: <span className="font-semibold text-foreground">{vehicle.year}</span>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {vehicles.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground mb-4">No vehicles in your fleet yet</p>
            {isAdminOrManager && (
              <div className="flex gap-2 justify-center">
                <AddVehiclePurchaseDialog onVehicleAdded={fetchVehicles} />
                <AddVehicleDialog onVehicleAdded={fetchVehicles} />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
