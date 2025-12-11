import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle, Clock, Snowflake, Sun, Car } from 'lucide-react';
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

export default function TireManagement() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [tireChanges, setTireChanges] = useState<TireChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState({
    tire_type: 'winter' as 'winter' | 'summer' | 'all_season',
    summer_tire_location: '',
    winter_tire_location: '',
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
      const [vehiclesRes, branchesRes, changesRes] = await Promise.all([
        supabase.from('vehicles').select('*, branches(name)').order('plate'),
        supabase.from('branches').select('*').order('name'),
        supabase.from('tire_changes').select('*, vehicles(plate, make, model), branches(name)').order('change_date', { ascending: false })
      ]);

      if (vehiclesRes.data) setVehicles(vehiclesRes.data);
      if (branchesRes.data) setBranches(branchesRes.data);
      if (changesRes.data) setTireChanges(changesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeasonalReminder = () => {
    const today = startOfDay(new Date());
    const currentYear = today.getFullYear();
    
    // Winter tire deadline: October 1 - October 14
    const winterStart = new Date(currentYear, 9, 1); // Oct 1
    const winterEnd = new Date(currentYear, 9, 14); // Oct 14
    
    // Summer tire deadline: May 1 - May 14
    const summerStart = new Date(currentYear, 4, 1); // May 1
    const summerEnd = new Date(currentYear, 4, 14); // May 14

    // Check if we're in winter tire season (approaching or within Oct 1-14)
    const daysUntilWinter = differenceInDays(winterStart, today);
    const isInWinterPeriod = isWithinInterval(today, { start: winterStart, end: winterEnd });
    
    // Check if we're in summer tire season (approaching or within May 1-14)
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
      // Create tire change log entry
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

      // Update vehicle's current tire type
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

        {/* Seasonal Reminder Alert */}
        {reminder && (
          <Alert variant={reminder.status === 'active' ? 'default' : 'default'} className={
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

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview by Branch</TabsTrigger>
            <TabsTrigger value="history">Change History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Branches with vehicles */}
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
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Vehicle</TableHead>
                              <TableHead>Plate</TableHead>
                              <TableHead>Current Tires</TableHead>
                              <TableHead>Summer Tire Location</TableHead>
                              <TableHead>Winter Tire Location</TableHead>
                              <TableHead>Notes</TableHead>
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
                                <TableCell>{vehicle.summer_tire_location || '-'}</TableCell>
                                <TableCell>{vehicle.winter_tire_location || '-'}</TableCell>
                                <TableCell className="max-w-[200px] truncate">{vehicle.tire_notes || '-'}</TableCell>
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

            {/* Unassigned vehicles */}
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
                            <TableHead>Notes</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getUnassignedVehicles().map(vehicle => (
                            <TableRow key={vehicle.id}>
                              <TableCell className="font-medium">{vehicle.make} {vehicle.model}</TableCell>
                              <TableCell>{vehicle.plate || 'N/A'}</TableCell>
                              <TableCell>{getTireStatusBadge(vehicle.current_tire_type)}</TableCell>
                              <TableCell>{vehicle.tire_notes || '-'}</TableCell>
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
                          <TableCell className="max-w-[300px] truncate">{change.notes || '-'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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
      </div>
    </Layout>
  );
}
