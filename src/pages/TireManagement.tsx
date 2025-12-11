import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle, Clock, Snowflake, Sun, Car, Plus, Trash2, Package } from 'lucide-react';
import { format, differenceInDays, isWithinInterval, startOfDay } from 'date-fns';

interface Vehicle {
  id: string;
  plate: string;
  make: string | null;
  model: string | null;
  current_tire_type: string | null;
  summer_tire_location: string | null;
  winter_tire_location: string | null;
  tire_notes: string | null;
  branch_id: string | null;
  branches?: { name: string } | null;
}

interface Branch {
  id: string;
  name: string;
  tire_notes: string | null;
}

interface TireChange {
  id: string;
  vehicle_id: string;
  branch_id: string | null;
  tire_type: string;
  change_date: string;
  summer_tire_location: string | null;
  winter_tire_location: string | null;
  notes: string | null;
  created_at: string;
  vehicles?: { plate: string; make: string | null; model: string | null } | null;
  branches?: { name: string } | null;
}

interface TireInventoryItem {
  id: string;
  branch_id: string;
  brand: string;
  measurements: string;
  condition: string;
  quantity: number;
  notes: string | null;
  branches?: { name: string } | null;
}

export default function TireManagement() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [tireChanges, setTireChanges] = useState<TireChange[]>([]);
  const [tireInventory, setTireInventory] = useState<TireInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inventoryDialogOpen, setInventoryDialogOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState({
    tire_type: 'winter' as 'winter' | 'summer' | 'all_season',
    summer_tire_location: '',
    winter_tire_location: '',
    notes: ''
  });
  const [inventoryFormData, setInventoryFormData] = useState({
    branch_id: '',
    brand: '',
    measurements: '',
    condition: 'good' as 'new' | 'good' | 'fair' | 'worn',
    quantity: 1,
    notes: ''
  });
  const { toast } = useToast();
  const { isAdminOrManager } = useUserRole();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vehiclesRes, branchesRes, changesRes, inventoryRes] = await Promise.all([
        supabase.from('vehicles').select('*, branches(name)').order('plate'),
        supabase.from('branches').select('*').order('name'),
        supabase.from('tire_changes').select('*, vehicles(plate, make, model), branches(name)').order('change_date', { ascending: false }),
        supabase.from('tire_inventory').select('*, branches(name)').order('brand')
      ]);

      if (vehiclesRes.data) setVehicles(vehiclesRes.data);
      if (branchesRes.data) setBranches(branchesRes.data);
      if (changesRes.data) setTireChanges(changesRes.data);
      if (inventoryRes.data) setTireInventory(inventoryRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeasonalReminder = () => {
    const today = startOfDay(new Date());
    const currentYear = today.getFullYear();
    
    const winterStart = new Date(currentYear, 9, 1);
    const winterEnd = new Date(currentYear, 9, 14);
    const summerStart = new Date(currentYear, 4, 1);
    const summerEnd = new Date(currentYear, 4, 14);

    const daysUntilWinter = differenceInDays(winterStart, today);
    const isInWinterPeriod = isWithinInterval(today, { start: winterStart, end: winterEnd });
    const daysUntilSummer = differenceInDays(summerStart, today);
    const isInSummerPeriod = isWithinInterval(today, { start: summerStart, end: summerEnd });

    if (isInWinterPeriod) {
      const daysRemaining = differenceInDays(winterEnd, today);
      return { type: 'winter', status: 'active', daysRemaining, message: `Winter tire change period - ${daysRemaining} days remaining` };
    }
    
    if (isInSummerPeriod) {
      const daysRemaining = differenceInDays(summerEnd, today);
      return { type: 'summer', status: 'active', daysRemaining, message: `Summer tire change period - ${daysRemaining} days remaining` };
    }

    if (daysUntilWinter > 0 && daysUntilWinter <= 30) {
      return { type: 'winter', status: 'upcoming', daysRemaining: daysUntilWinter, message: `Winter tire change starts in ${daysUntilWinter} days (October 1)` };
    }

    if (daysUntilSummer > 0 && daysUntilSummer <= 30) {
      return { type: 'summer', status: 'upcoming', daysRemaining: daysUntilSummer, message: `Summer tire change starts in ${daysUntilSummer} days (May 1)` };
    }

    return null;
  };

  const reminder = getSeasonalReminder();

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

  const getVehiclesByBranch = (branchId: string) => {
    return vehicles.filter(v => v.branch_id === branchId);
  };

  const getUnassignedVehicles = () => {
    return vehicles.filter(v => !v.branch_id);
  };

  const getTireStatusBadge = (tireType: string | null) => {
    switch (tireType) {
      case 'winter':
        return <Badge className="bg-blue-500 hover:bg-blue-600"><Snowflake className="h-3 w-3 mr-1" /> Winter</Badge>;
      case 'summer':
        return <Badge className="bg-orange-500 hover:bg-orange-600"><Sun className="h-3 w-3 mr-1" /> Summer</Badge>;
      case 'all_season':
        return <Badge variant="secondary"><Car className="h-3 w-3 mr-1" /> All Season</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getConditionBadge = (condition: string) => {
    switch (condition) {
      case 'new':
        return <Badge className="bg-green-500">New</Badge>;
      case 'good':
        return <Badge className="bg-blue-500">Good</Badge>;
      case 'fair':
        return <Badge className="bg-yellow-500">Fair</Badge>;
      case 'worn':
        return <Badge className="bg-red-500">Worn</Badge>;
      default:
        return <Badge variant="outline">{condition}</Badge>;
    }
  };

  const openChangeDialog = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setFormData({
      tire_type: (vehicle.current_tire_type as 'winter' | 'summer' | 'all_season') || 'summer',
      summer_tire_location: vehicle.summer_tire_location || '',
      winter_tire_location: vehicle.winter_tire_location || '',
      notes: ''
    });
    setDialogOpen(true);
  };

  const handleTireChange = async () => {
    if (!selectedVehicle) return;

    try {
      const { error: logError } = await supabase.from('tire_changes').insert({
        vehicle_id: selectedVehicle.id,
        branch_id: selectedVehicle.branch_id,
        tire_type: formData.tire_type,
        current_tire_type: formData.tire_type,
        summer_tire_location: formData.summer_tire_location || null,
        winter_tire_location: formData.winter_tire_location || null,
        notes: formData.notes || null
      });

      if (logError) throw logError;

      const { error: updateError } = await supabase.from('vehicles').update({
        current_tire_type: formData.tire_type,
        summer_tire_location: formData.summer_tire_location || null,
        winter_tire_location: formData.winter_tire_location || null,
        tire_notes: formData.notes || null
      }).eq('id', selectedVehicle.id);

      if (updateError) throw updateError;

      toast({ title: 'Success', description: 'Tire change recorded successfully' });
      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error recording tire change:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleAddInventory = async () => {
    if (!inventoryFormData.branch_id || !inventoryFormData.brand || !inventoryFormData.measurements) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase.from('tire_inventory').insert({
        branch_id: inventoryFormData.branch_id,
        brand: inventoryFormData.brand,
        measurements: inventoryFormData.measurements,
        condition: inventoryFormData.condition,
        quantity: inventoryFormData.quantity,
        notes: inventoryFormData.notes || null
      });

      if (error) throw error;

      toast({ title: 'Success', description: 'Tire added to inventory' });
      setInventoryDialogOpen(false);
      setInventoryFormData({ branch_id: '', brand: '', measurements: '', condition: 'good', quantity: 1, notes: '' });
      fetchData();
    } catch (error: any) {
      console.error('Error adding tire:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteInventory = async (id: string) => {
    try {
      const { error } = await supabase.from('tire_inventory').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Success', description: 'Tire removed from inventory' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const updateBranchNotes = async (branchId: string, notes: string) => {
    try {
      const { error } = await supabase.from('branches').update({ tire_notes: notes }).eq('id', branchId);
      if (error) throw error;
      setBranches(prev => prev.map(b => b.id === branchId ? { ...b, tire_notes: notes } : b));
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const getBranchComplianceStats = (branchId: string) => {
    const branchVehicles = getVehiclesByBranch(branchId);
    const expectedTireType = reminder?.type || 'summer';
    const compliant = branchVehicles.filter(v => 
      v.current_tire_type === expectedTireType || v.current_tire_type === 'all_season'
    ).length;
    return { total: branchVehicles.length, compliant };
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-muted-foreground">Loading tire management...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Tire Management</h1>
          <p className="text-muted-foreground">Track and manage seasonal tire changes across your fleet</p>
        </div>

        {reminder && (
          <Alert variant="default" className={
            reminder.status === 'active' 
              ? 'border-yellow-500 bg-yellow-500/10' 
              : 'border-blue-500 bg-blue-500/10'
          }>
            {reminder.type === 'winter' ? <Snowflake className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            <AlertTitle className="flex items-center gap-2">
              {reminder.status === 'active' ? (
                <><AlertTriangle className="h-4 w-4 text-yellow-500" /> Action Required</>
              ) : (
                <><Clock className="h-4 w-4 text-blue-500" /> Upcoming</>
              )}
            </AlertTitle>
            <AlertDescription>
              {reminder.message}. {reminder.type === 'winter' 
                ? 'Winter tires must be installed by October 14.' 
                : 'Summer tires should be installed by May 14.'}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Branch Overview */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Overview by Branch</TabsTrigger>
                <TabsTrigger value="history">Change History</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                {branches.map(branch => {
                  const branchVehicles = getVehiclesByBranch(branch.id);
                  const stats = getBranchComplianceStats(branch.id);
                  const isExpanded = expandedBranches.has(branch.id);

                  if (branchVehicles.length === 0) return null;

                  return (
                    <Card key={branch.id}>
                      <Collapsible open={isExpanded} onOpenChange={() => toggleBranch(branch.id)}>
                        <CollapsibleTrigger asChild>
                          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                                <div>
                                  <CardTitle className="text-lg">{branch.name}</CardTitle>
                                  <CardDescription>{branchVehicles.length} vehicle(s)</CardDescription>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {stats.compliant === stats.total ? (
                                  <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> All Complete</Badge>
                                ) : (
                                  <Badge variant="outline">{stats.compliant}/{stats.total} Complete</Badge>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent className="space-y-4">
                            {/* Branch Tire Notes */}
                            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                              <Label className="text-sm font-medium">Branch Tire Notes</Label>
                              <Textarea
                                placeholder="Add notes about extra tire sets, storage info, etc..."
                                value={branch.tire_notes || ''}
                                onChange={(e) => updateBranchNotes(branch.id, e.target.value)}
                                className="min-h-[60px]"
                              />
                            </div>

                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Vehicle</TableHead>
                                  <TableHead>Plate</TableHead>
                                  <TableHead>Current Tires</TableHead>
                                  <TableHead>Summer Location</TableHead>
                                  <TableHead>Winter Location</TableHead>
                                  <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {branchVehicles.map(vehicle => (
                                  <TableRow key={vehicle.id}>
                                    <TableCell className="font-medium">
                                      {vehicle.make} {vehicle.model}
                                    </TableCell>
                                    <TableCell>{vehicle.plate || 'N/A'}</TableCell>
                                    <TableCell>{getTireStatusBadge(vehicle.current_tire_type)}</TableCell>
                                    <TableCell className="max-w-[120px] truncate">{vehicle.summer_tire_location || '-'}</TableCell>
                                    <TableCell className="max-w-[120px] truncate">{vehicle.winter_tire_location || '-'}</TableCell>
                                    <TableCell className="text-right">
                                      <Button size="sm" variant="outline" onClick={() => openChangeDialog(vehicle)}>
                                        Record Change
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </CollapsibleContent>
                      </Collapsible>
                    </Card>
                  );
                })}

                {getUnassignedVehicles().length > 0 && (
                  <Card>
                    <Collapsible open={expandedBranches.has('unassigned')} onOpenChange={() => toggleBranch('unassigned')}>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            {expandedBranches.has('unassigned') ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                            <div>
                              <CardTitle className="text-lg">Unassigned Vehicles</CardTitle>
                              <CardDescription>{getUnassignedVehicles().length} vehicle(s)</CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Vehicle</TableHead>
                                <TableHead>Plate</TableHead>
                                <TableHead>Current Tires</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {getUnassignedVehicles().map(vehicle => (
                                <TableRow key={vehicle.id}>
                                  <TableCell className="font-medium">{vehicle.make} {vehicle.model}</TableCell>
                                  <TableCell>{vehicle.plate || 'N/A'}</TableCell>
                                  <TableCell>{getTireStatusBadge(vehicle.current_tire_type)}</TableCell>
                                  <TableCell className="text-right">
                                    <Button size="sm" variant="outline" onClick={() => openChangeDialog(vehicle)}>
                                      Record Change
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="history" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Tire Change History</CardTitle>
                    <CardDescription>Complete log of all tire changes across the fleet</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Branch</TableHead>
                          <TableHead>Vehicle</TableHead>
                          <TableHead>Changed To</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tireChanges.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                              No tire changes recorded yet
                            </TableCell>
                          </TableRow>
                        ) : (
                          tireChanges.map(change => (
                            <TableRow key={change.id}>
                              <TableCell>{format(new Date(change.change_date), 'MMM d, yyyy')}</TableCell>
                              <TableCell>{change.branches?.name || 'N/A'}</TableCell>
                              <TableCell>
                                {change.vehicles?.make} {change.vehicles?.model} ({change.vehicles?.plate})
                              </TableCell>
                              <TableCell>{getTireStatusBadge(change.tire_type)}</TableCell>
                              <TableCell className="max-w-[200px] truncate">{change.notes || '-'}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar - Tire Inventory */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Tire Inventory
                  </CardTitle>
                  <CardDescription>Available spare tires across all branches</CardDescription>
                </div>
                <Button size="sm" onClick={() => setInventoryDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  {tireInventory.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No spare tires in inventory</p>
                      <p className="text-sm">Add tires to track availability</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Brand</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Cond.</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tireInventory.map(item => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{item.brand}</p>
                                <p className="text-xs text-muted-foreground">{item.branches?.name}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{item.measurements}</TableCell>
                            <TableCell>{getConditionBadge(item.condition)}</TableCell>
                            <TableCell>
                              {isAdminOrManager && (
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-7 w-7"
                                  onClick={() => handleDeleteInventory(item.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Record Tire Change Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Tire Change</DialogTitle>
            </DialogHeader>
            {selectedVehicle && (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{selectedVehicle.make} {selectedVehicle.model}</p>
                  <p className="text-sm text-muted-foreground">Plate: {selectedVehicle.plate || 'N/A'}</p>
                </div>

                <div className="space-y-2">
                  <Label>Tire Type Installed</Label>
                  <Select value={formData.tire_type} onValueChange={(v) => setFormData(prev => ({ ...prev, tire_type: v as any }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="winter"><Snowflake className="h-4 w-4 inline mr-2" /> Winter Tires</SelectItem>
                      <SelectItem value="summer"><Sun className="h-4 w-4 inline mr-2" /> Summer Tires</SelectItem>
                      <SelectItem value="all_season"><Car className="h-4 w-4 inline mr-2" /> All Season Tires</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Summer Tire Storage Location</Label>
                  <Textarea 
                    placeholder="Where are summer tires stored?"
                    value={formData.summer_tire_location}
                    onChange={(e) => setFormData(prev => ({ ...prev, summer_tire_location: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Winter Tire Storage Location</Label>
                  <Textarea 
                    placeholder="Where are winter tires stored?"
                    value={formData.winter_tire_location}
                    onChange={(e) => setFormData(prev => ({ ...prev, winter_tire_location: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea 
                    placeholder="Any additional notes about this tire change..."
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleTireChange}>Save Change</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Add Tire Inventory Dialog */}
        <Dialog open={inventoryDialogOpen} onOpenChange={setInventoryDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Tire to Inventory</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Branch Location *</Label>
                <Select value={inventoryFormData.branch_id} onValueChange={(v) => setInventoryFormData(prev => ({ ...prev, branch_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(branch => (
                      <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Brand *</Label>
                <Input 
                  placeholder="e.g., Michelin, Bridgestone"
                  value={inventoryFormData.brand}
                  onChange={(e) => setInventoryFormData(prev => ({ ...prev, brand: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Measurements/Size *</Label>
                <Input 
                  placeholder="e.g., 225/65R17"
                  value={inventoryFormData.measurements}
                  onChange={(e) => setInventoryFormData(prev => ({ ...prev, measurements: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Condition</Label>
                <Select value={inventoryFormData.condition} onValueChange={(v) => setInventoryFormData(prev => ({ ...prev, condition: v as any }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="worn">Worn</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea 
                  placeholder="Additional info (e.g., 'Extra set for Caravan')"
                  value={inventoryFormData.notes}
                  onChange={(e) => setInventoryFormData(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setInventoryDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddInventory}>Add to Inventory</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
