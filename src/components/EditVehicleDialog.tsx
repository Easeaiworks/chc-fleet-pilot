import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Pencil } from 'lucide-react';

interface Branch {
  id: string;
  name: string;
}

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
  branch_id?: string | null;
}

interface EditVehicleDialogProps {
  vehicle: Vehicle;
  onVehicleUpdated: () => void;
}

export function EditVehicleDialog({ vehicle, onVehicleUpdated }: EditVehicleDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isActive, setIsActive] = useState(vehicle.status === 'active');
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    vin: vehicle.vin,
    plate: vehicle.plate,
    make: vehicle.make || '',
    model: vehicle.model || '',
    year: vehicle.year?.toString() || '',
    branchId: vehicle.branch_id || '',
    odometerKm: vehicle.odometer_km.toString(),
    lastOilChangeKm: vehicle.last_oil_change_km?.toString() || '',
    lastTireChangeDate: vehicle.last_tire_change_date || '',
    notes: vehicle.notes || '',
  });

  useEffect(() => {
    if (open) {
      fetchBranches();
      // Reset form data when dialog opens
      setFormData({
        vin: vehicle.vin,
        plate: vehicle.plate,
        make: vehicle.make || '',
        model: vehicle.model || '',
        year: vehicle.year?.toString() || '',
        branchId: vehicle.branch_id || '',
        odometerKm: vehicle.odometer_km.toString(),
        lastOilChangeKm: vehicle.last_oil_change_km?.toString() || '',
        lastTireChangeDate: vehicle.last_tire_change_date || '',
        notes: vehicle.notes || '',
      });
      setIsActive(vehicle.status === 'active');
    }
  }, [open, vehicle]);

  const fetchBranches = async () => {
    const { data } = await supabase
      .from('branches')
      .select('id, name')
      .order('name');
    if (data) setBranches(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from('vehicles')
      .update({
        vin: formData.vin,
        plate: formData.plate,
        make: formData.make || null,
        model: formData.model || null,
        year: formData.year ? parseInt(formData.year) : null,
        branch_id: formData.branchId || null,
        odometer_km: parseInt(formData.odometerKm) || 0,
        last_oil_change_km: formData.lastOilChangeKm ? parseInt(formData.lastOilChangeKm) : null,
        last_tire_change_date: formData.lastTireChangeDate || null,
        notes: formData.notes || null,
        status: isActive ? 'active' : 'retired',
      })
      .eq('id', vehicle.id);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Vehicle updated successfully',
      });
      setOpen(false);
      onVehicleUpdated();
    }

    setLoading(false);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this vehicle? This will also delete all associated expenses and documents. This cannot be undone.')) {
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from('vehicles')
      .delete()
      .eq('id', vehicle.id);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Vehicle deleted successfully',
      });
      setOpen(false);
      // Navigate back to home after delete
      window.location.href = '/';
    }

    setLoading(false);
  };

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" />
        Edit Vehicle
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Vehicle</DialogTitle>
            <DialogDescription>
              Update the vehicle details
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vin">VIN *</Label>
                <Input
                  id="vin"
                  value={formData.vin}
                  onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
                  required
                  placeholder="1HGBH41JXMN109186"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plate">License Plate *</Label>
                <Input
                  id="plate"
                  value={formData.plate}
                  onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
                  required
                  placeholder="ABC-1234"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="make">Make</Label>
                <Input
                  id="make"
                  value={formData.make}
                  onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                  placeholder="Ford"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="F-150"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  placeholder="2024"
                  min="1900"
                  max={new Date().getFullYear() + 1}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch">Branch/Location</Label>
              <Select value={formData.branchId} onValueChange={(value) => setFormData({ ...formData, branchId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="odometer">Current Odometer (km)</Label>
                <Input
                  id="odometer"
                  type="number"
                  value={formData.odometerKm}
                  onChange={(e) => setFormData({ ...formData, odometerKm: e.target.value })}
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastOil">Last Oil Change (km)</Label>
                <Input
                  id="lastOil"
                  type="number"
                  value={formData.lastOilChangeKm}
                  onChange={(e) => setFormData({ ...formData, lastOilChangeKm: e.target.value })}
                  min="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastTire">Last Tire Change Date</Label>
              <Input
                id="lastTire"
                type="date"
                value={formData.lastTireChangeDate}
                onChange={(e) => setFormData({ ...formData, lastTireChangeDate: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div className="space-y-0.5">
                <Label htmlFor="active-toggle">Vehicle Status</Label>
                <p className="text-sm text-muted-foreground">
                  {isActive ? 'Active - In current use' : 'Inactive - Not in use'}
                </p>
              </div>
              <Switch
                id="active-toggle"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about this vehicle..."
                rows={3}
              />
            </div>

            <div className="flex justify-between gap-2">
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={loading}>
                Delete Vehicle
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}