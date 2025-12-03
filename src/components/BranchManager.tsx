import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Building2, Plus, MapPin, Pencil, Trash2, ChevronDown, ChevronRight, Car, Gauge } from 'lucide-react';
import { AddVehicleDialog } from './AddVehicleDialog';

interface Branch {
  id: string;
  name: string;
  location: string | null;
}

interface Vehicle {
  id: string;
  vin: string;
  plate: string;
  make: string | null;
  model: string | null;
  year: number | null;
  odometer_km: number;
  status: string;
  branch_id: string | null;
}

export function BranchManager() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [open, setOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { isAdminOrManager } = useUserRole();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    location: '',
  });

  useEffect(() => {
    fetchBranches();
    fetchVehicles();
  }, []);

  const fetchBranches = async () => {
    const { data } = await supabase
      .from('branches')
      .select('*')
      .order('name');
    if (data) setBranches(data);
  };

  const fetchVehicles = async () => {
    const { data } = await supabase
      .from('vehicles')
      .select('*')
      .order('plate');
    if (data) setVehicles(data);
  };

  const getVehiclesForBranch = (branchId: string) => {
    return vehicles.filter(v => v.branch_id === branchId);
  };

  const getUnassignedVehicles = () => {
    return vehicles.filter(v => !v.branch_id);
  };

  const toggleBranch = (branchId: string) => {
    setExpandedBranches(prev => {
      const newSet = new Set(prev);
      if (newSet.has(branchId)) {
        newSet.delete(branchId);
      } else {
        newSet.add(branchId);
      }
      return newSet;
    });
  };

  const openAddDialog = () => {
    setEditingBranch(null);
    setFormData({ name: '', location: '' });
    setOpen(true);
  };

  const openEditDialog = (branch: Branch, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      location: branch.location || '',
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (editingBranch) {
      const { error } = await supabase
        .from('branches')
        .update({
          name: formData.name,
          location: formData.location || null,
        })
        .eq('id', editingBranch.id);

      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success',
          description: 'Branch updated successfully',
        });
        setOpen(false);
        setEditingBranch(null);
        setFormData({ name: '', location: '' });
        fetchBranches();
      }
    } else {
      const { error } = await supabase.from('branches').insert({
        name: formData.name,
        location: formData.location || null,
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
          description: 'Branch added successfully',
        });
        setOpen(false);
        setFormData({ name: '', location: '' });
        fetchBranches();
      }
    }

    setLoading(false);
  };

  const handleDelete = async (branch: Branch, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${branch.name}"? This cannot be undone.`)) {
      return;
    }

    const { error } = await supabase
      .from('branches')
      .delete()
      .eq('id', branch.id);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Branch deleted successfully',
      });
      fetchBranches();
    }
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

  const VehicleRow = ({ vehicle }: { vehicle: Vehicle }) => (
    <div
      className="flex items-center justify-between p-3 bg-background border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
      onClick={() => navigate(`/vehicles/${vehicle.id}`)}
    >
      <div className="flex items-center gap-3">
        <Car className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="font-medium text-sm">
            {vehicle.make && vehicle.model 
              ? `${vehicle.make} ${vehicle.model}` 
              : vehicle.plate}
          </p>
          <p className="text-xs text-muted-foreground">
            {vehicle.plate} {vehicle.year && `• ${vehicle.year}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Gauge className="h-3 w-3" />
          {vehicle.odometer_km.toLocaleString()} km
        </div>
        <Badge className={`${getStatusColor(vehicle.status)} text-xs`}>
          {vehicle.status}
        </Badge>
      </div>
    </div>
  );

  const unassignedVehicles = getUnassignedVehicles();

  return (
    <Card className="shadow-card col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Fleet by Location
            </CardTitle>
            <CardDescription>Click a branch to view its vehicles</CardDescription>
          </div>
          <div className="flex gap-2">
            {isAdminOrManager && <AddVehicleDialog onVehicleAdded={fetchVehicles} />}
            {isAdminOrManager && (
              <Button size="sm" variant="outline" className="gap-2" onClick={openAddDialog}>
                <Plus className="h-4 w-4" />
                Add Branch
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {branches.length === 0 && unassignedVehicles.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No branches or vehicles added yet
          </p>
        ) : (
          <>
            {branches.map((branch) => {
              const branchVehicles = getVehiclesForBranch(branch.id);
              const isExpanded = expandedBranches.has(branch.id);
              
              return (
                <Collapsible 
                  key={branch.id} 
                  open={isExpanded}
                  onOpenChange={() => toggleBranch(branch.id)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Building2 className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-semibold">{branch.name}</p>
                          {branch.location && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {branch.location}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="text-xs">
                          {branchVehicles.length} vehicle{branchVehicles.length !== 1 ? 's' : ''}
                        </Badge>
                        {isAdminOrManager && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => openEditDialog(branch, e)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={(e) => handleDelete(branch, e)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-8 mt-2 space-y-2">
                      {branchVehicles.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2 pl-3">
                          No vehicles assigned to this branch
                        </p>
                      ) : (
                        branchVehicles.map((vehicle) => (
                          <VehicleRow key={vehicle.id} vehicle={vehicle} />
                        ))
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}

            {unassignedVehicles.length > 0 && (
              <Collapsible 
                open={expandedBranches.has('unassigned')}
                onOpenChange={() => toggleBranch('unassigned')}
              >
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-3 border rounded-lg border-dashed hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      {expandedBranches.has('unassigned') ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Car className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-semibold text-muted-foreground">Unassigned Vehicles</p>
                        <p className="text-sm text-muted-foreground">Vehicles not assigned to any branch</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {unassignedVehicles.length} vehicle{unassignedVehicles.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-8 mt-2 space-y-2">
                    {unassignedVehicles.map((vehicle) => (
                      <VehicleRow key={vehicle.id} vehicle={vehicle} />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBranch ? 'Edit Branch' : 'Add New Branch'}</DialogTitle>
            <DialogDescription>
              {editingBranch ? 'Update the branch details below.' : 'Enter the details for the new branch location.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Branch Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Hamilton"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location (Optional)</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., 123 Main St, Hamilton, ON"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : editingBranch ? 'Update' : 'Add Branch'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
