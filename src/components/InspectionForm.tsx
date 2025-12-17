import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Vehicle {
  id: string;
  plate: string;
  make: string | null;
  model: string | null;
  branch_id: string | null;
}

interface Branch {
  id: string;
  name: string;
}

interface InspectionItem {
  key: string;
  label: string;
  pass: boolean;
  notes: string;
}

const INSPECTION_ITEMS = [
  { key: 'brakes', label: 'Brakes' },
  { key: 'engine', label: 'Engine' },
  { key: 'transmission', label: 'Transmission' },
  { key: 'tires', label: 'Tires' },
  { key: 'headlights', label: 'Headlights' },
  { key: 'signal_lights', label: 'Signal Lights' },
  { key: 'oil_level', label: 'Oil Level' },
  { key: 'windshield_fluid', label: 'Windshield Fluid' },
  { key: 'wipers', label: 'Wipers' },
];

export function InspectionForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [kilometers, setKilometers] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [inspectionItems, setInspectionItems] = useState<InspectionItem[]>(
    INSPECTION_ITEMS.map(item => ({ ...item, pass: true, notes: '' }))
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vehiclesRes, branchesRes] = await Promise.all([
        supabase.from('vehicles').select('id, plate, make, model, branch_id').eq('status', 'active').order('plate'),
        supabase.from('branches').select('id, name').order('name'),
      ]);

      if (vehiclesRes.data) setVehicles(vehiclesRes.data);
      if (branchesRes.data) setBranches(branchesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGPSKilometers = async (vehicleId: string) => {
    try {
      // Get total kilometers from GPS uploads for current year
      const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('gps_uploads')
        .select('kilometers')
        .eq('vehicle_id', vehicleId)
        .gte('upload_month', startOfYear);

      if (error) throw error;

      const total = data?.reduce((sum, record) => sum + Number(record.kilometers || 0), 0) || 0;
      setKilometers(Math.round(total));
    } catch (error) {
      console.error('Error fetching GPS data:', error);
      setKilometers(null);
    }
  };

  const handleVehicleChange = (vehicleId: string) => {
    setSelectedVehicle(vehicleId);
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle?.branch_id) {
      setSelectedBranch(vehicle.branch_id);
    }
    fetchGPSKilometers(vehicleId);
  };

  const toggleItem = (key: string) => {
    setInspectionItems(items =>
      items.map(item =>
        item.key === key ? { ...item, pass: !item.pass, notes: item.pass ? item.notes : '' } : item
      )
    );
  };

  const updateNotes = (key: string, notes: string) => {
    setInspectionItems(items =>
      items.map(item => (item.key === key ? { ...item, notes } : item))
    );
  };

  const handleSubmit = async () => {
    if (!selectedVehicle || !selectedBranch) {
      toast({ title: 'Please select a vehicle and location', variant: 'destructive' });
      return;
    }

    // Check if any failed items are missing notes
    const failedWithoutNotes = inspectionItems.filter(item => !item.pass && !item.notes.trim());
    if (failedWithoutNotes.length > 0) {
      toast({
        title: 'Notes required for failed items',
        description: `Please add notes for: ${failedWithoutNotes.map(i => i.label).join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('vehicle_inspections').insert({
        vehicle_id: selectedVehicle,
        branch_id: selectedBranch,
        kilometers,
        completed_by: user?.id,
        brakes_pass: inspectionItems.find(i => i.key === 'brakes')?.pass ?? true,
        brakes_notes: inspectionItems.find(i => i.key === 'brakes')?.notes || null,
        engine_pass: inspectionItems.find(i => i.key === 'engine')?.pass ?? true,
        engine_notes: inspectionItems.find(i => i.key === 'engine')?.notes || null,
        transmission_pass: inspectionItems.find(i => i.key === 'transmission')?.pass ?? true,
        transmission_notes: inspectionItems.find(i => i.key === 'transmission')?.notes || null,
        tires_pass: inspectionItems.find(i => i.key === 'tires')?.pass ?? true,
        tires_notes: inspectionItems.find(i => i.key === 'tires')?.notes || null,
        headlights_pass: inspectionItems.find(i => i.key === 'headlights')?.pass ?? true,
        headlights_notes: inspectionItems.find(i => i.key === 'headlights')?.notes || null,
        signal_lights_pass: inspectionItems.find(i => i.key === 'signal_lights')?.pass ?? true,
        signal_lights_notes: inspectionItems.find(i => i.key === 'signal_lights')?.notes || null,
        oil_level_pass: inspectionItems.find(i => i.key === 'oil_level')?.pass ?? true,
        oil_level_notes: inspectionItems.find(i => i.key === 'oil_level')?.notes || null,
        windshield_fluid_pass: inspectionItems.find(i => i.key === 'windshield_fluid')?.pass ?? true,
        windshield_fluid_notes: inspectionItems.find(i => i.key === 'windshield_fluid')?.notes || null,
        wipers_pass: inspectionItems.find(i => i.key === 'wipers')?.pass ?? true,
        wipers_notes: inspectionItems.find(i => i.key === 'wipers')?.notes || null,
      });

      if (error) throw error;

      toast({ title: 'Inspection submitted successfully' });
      
      // Reset form
      setSelectedVehicle('');
      setSelectedBranch('');
      setKilometers(null);
      setInspectionItems(INSPECTION_ITEMS.map(item => ({ ...item, pass: true, notes: '' })));
    } catch (error: any) {
      toast({ title: 'Error submitting inspection', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedVehicleData = vehicles.find(v => v.id === selectedVehicle);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto print:shadow-none print:border-none">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Monthly Vehicle Inspection</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Vehicle Selection */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Vehicle</Label>
            <Select value={selectedVehicle} onValueChange={handleVehicleChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a vehicle" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                {vehicles.map(vehicle => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.plate} - {vehicle.make} {vehicle.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Location</Label>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                {branches.map(branch => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {kilometers !== null && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Year-to-Date Kilometers</p>
              <p className="text-xl font-semibold">{kilometers.toLocaleString()} km</p>
            </div>
          )}
        </div>

        {/* Inspection Items */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Inspection Checklist</Label>
          <div className="space-y-2">
            {inspectionItems.map(item => (
              <div key={item.key} className="space-y-2">
                <button
                  type="button"
                  onClick={() => toggleItem(item.key)}
                  className={cn(
                    'w-full flex items-center justify-between p-3 rounded-lg border transition-colors',
                    item.pass
                      ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
                      : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
                  )}
                >
                  <span className="font-medium">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-sm', item.pass ? 'text-green-600' : 'text-red-600')}>
                      {item.pass ? 'Pass' : 'Fail'}
                    </span>
                    {item.pass ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                </button>
                {!item.pass && (
                  <Textarea
                    placeholder={`What's wrong with ${item.label.toLowerCase()}?`}
                    value={item.notes}
                    onChange={e => updateNotes(item.key, e.target.value)}
                    className="text-sm"
                    rows={2}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={submitting || !selectedVehicle || !selectedBranch}
          className="w-full"
          size="lg"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit Inspection'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
