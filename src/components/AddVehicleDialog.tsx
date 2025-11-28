import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus } from 'lucide-react';

interface Branch {
  id: string;
  name: string;
}

interface AddVehicleDialogProps {
  onVehicleAdded: () => void;
}

export function AddVehicleDialog({ onVehicleAdded }: AddVehicleDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isActive, setIsActive] = useState(true);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    vin: '',
    plate: '',
    make: '',
    model: '',
    year: '',
    branchId: '',
    odometerKm: '0',
    lastOilChangeKm: '',
    notes: '',
  });

  useEffect(() => {
    if (open) {
      fetchBranches();
    }
  }, [open]);

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

    const { error } = await supabase.from('vehicles').insert({
      vin: formData.vin,
      plate: formData.plate,
      make: formData.make || null,
      model: formData.model || null,
      year: formData.year ? parseInt(formData.year) : null,
      branch_id: formData.branchId || null,
      odometer_km: parseInt(formData.odometerKm) || 0,
      last_oil_change_km: formData.lastOilChangeKm ? parseInt(formData.lastOilChangeKm) : null,
      notes: formData.notes || null,
      status: isActive ? 'active' : 'retired',
    });

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Vehicle added successfully',
      });
      setOpen(false);
      setFormData({
        vin: '',
        plate: '',
        make: '',
        model: '',
        year: '',
        branchId: '',
        odometerKm: '0',
        lastOilChangeKm: '',
        notes: '',
      });
      setIsActive(true);
      onVehicleAdded();
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Vehicle
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Vehicle</DialogTitle>
          <DialogDescription>
            Enter the vehicle details to add it to your fleet
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

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Vehicle'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
