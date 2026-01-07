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
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle, Clock, Snowflake, Sun, Car, Plus, Trash2, Disc3, ArrowRight, Check, X, Pencil } from 'lucide-react';
import { format, differenceInDays, isWithinInterval, startOfDay } from 'date-fns';

interface Vehicle {
  id: string;
  plate: string;
  make: string | null;
  model: string | null;
  current_tire_type: string | null;
  summer_tire_location: string | null;
  winter_tire_location: string | null;
  summer_tire_brand: string | null;
  summer_tire_measurements: string | null;
  summer_tire_condition: string | null;
  winter_tire_brand: string | null;
  winter_tire_measurements: string | null;
  winter_tire_condition: string | null;
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
  tire_type: string;
  quantity: number;
  notes: string | null;
  on_rim: boolean;
  bolt_pattern: string | null;
  branches?: { name: string } | null;
}

interface TireClaimRequest {
  id: string;
  inventory_item_id: string;
  vehicle_id: string;
  branch_id: string | null;
  requested_by: string | null;
  tire_type: 'winter' | 'summer';
  status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  vehicles?: { plate: string; make: string | null; model: string | null } | null;
  branches?: { name: string } | null;
  tire_inventory?: { brand: string; measurements: string; condition: string } | null;
}

export default function TireManagement() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [tireChanges, setTireChanges] = useState<TireChange[]>([]);
  const [tireInventory, setTireInventory] = useState<TireInventoryItem[]>([]);
  const [claimRequests, setClaimRequests] = useState<TireClaimRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());
  const [expandedVehicles, setExpandedVehicles] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inventoryDialogOpen, setInventoryDialogOpen] = useState(false);
  const [editInventoryDialogOpen, setEditInventoryDialogOpen] = useState(false);
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [editingInventoryItem, setEditingInventoryItem] = useState<TireInventoryItem | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<TireInventoryItem | null>(null);
  const [formData, setFormData] = useState({
    tire_type: 'winter' as 'winter' | 'summer' | 'all_season',
    summer_tire_location: '',
    winter_tire_location: '',
    summer_tire_brand: '',
    summer_tire_measurements: '',
    summer_tire_condition: 'good',
    winter_tire_brand: '',
    winter_tire_measurements: '',
    winter_tire_condition: 'good',
    notes: ''
  });
  const [inventoryFormData, setInventoryFormData] = useState({
    branch_id: '',
    brand: '',
    measurements: '',
    condition: 'good' as 'new' | 'good' | 'fair' | 'worn',
    tire_type: 'all_season' as 'summer' | 'winter' | 'all_season',
    quantity: 1,
    notes: '',
    on_rim: false,
    bolt_pattern: '' as '' | '4_bolt' | '5_bolt' | '6_bolt' | '8_bolt'
  });
  const [claimFormData, setClaimFormData] = useState({
    vehicle_id: '',
    branch_id: '',
    tire_type: 'summer' as 'winter' | 'summer',
    notes: ''
  });
  const { toast } = useToast();
  const { isAdminOrManager, isAdmin } = useUserRole();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vehiclesRes, branchesRes, changesRes, inventoryRes, claimsRes] = await Promise.all([
        supabase.from('vehicles').select('*, branches(name)').order('plate'),
        supabase.from('branches').select('*').order('name'),
        supabase.from('tire_changes').select('*, vehicles(plate, make, model), branches(name)').order('change_date', { ascending: false }),
        supabase.from('tire_inventory').select('*, branches(name)').order('brand'),
        supabase.from('tire_claim_requests').select('*, vehicles(plate, make, model), branches(name), tire_inventory(brand, measurements, condition)').order('created_at', { ascending: false })
      ]);

      if (vehiclesRes.data) setVehicles(vehiclesRes.data as Vehicle[]);
      if (branchesRes.data) setBranches(branchesRes.data);
      if (changesRes.data) setTireChanges(changesRes.data);
      if (inventoryRes.data) setTireInventory(inventoryRes.data);
      if (claimsRes.data) setClaimRequests(claimsRes.data as TireClaimRequest[]);
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

  const toggleVehicle = (vehicleId: string) => {
    setExpandedVehicles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(vehicleId)) {
        newSet.delete(vehicleId);
      } else {
        newSet.add(vehicleId);
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

  const getConditionBadge = (condition: string | null) => {
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
        return <Badge variant="outline">-</Badge>;
    }
  };

  const openChangeDialog = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    // Map the current tire type, defaulting to 'summer' only if null/undefined
    const currentTireType = vehicle.current_tire_type;
    const validTireTypes = ['winter', 'summer', 'all_season'];
    const mappedTireType = currentTireType && validTireTypes.includes(currentTireType) 
      ? currentTireType as 'winter' | 'summer' | 'all_season'
      : 'summer';
    
    setFormData({
      tire_type: mappedTireType,
      summer_tire_location: vehicle.summer_tire_location || '',
      winter_tire_location: vehicle.winter_tire_location || '',
      summer_tire_brand: vehicle.summer_tire_brand || '',
      summer_tire_measurements: vehicle.summer_tire_measurements || '',
      summer_tire_condition: vehicle.summer_tire_condition || 'good',
      winter_tire_brand: vehicle.winter_tire_brand || '',
      winter_tire_measurements: vehicle.winter_tire_measurements || '',
      winter_tire_condition: vehicle.winter_tire_condition || 'good',
      notes: ''
    });
    setDialogOpen(true);
  };

  const openClaimDialog = (item: TireInventoryItem) => {
    setSelectedInventoryItem(item);
    setClaimFormData({
      vehicle_id: '',
      branch_id: '',
      tire_type: 'summer',
      notes: ''
    });
    setClaimDialogOpen(true);
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
        last_tire_change_date: new Date().toISOString().split('T')[0],
        summer_tire_location: formData.summer_tire_location || null,
        winter_tire_location: formData.winter_tire_location || null,
        summer_tire_brand: formData.summer_tire_brand || null,
        summer_tire_measurements: formData.summer_tire_measurements || null,
        summer_tire_condition: formData.summer_tire_condition || null,
        winter_tire_brand: formData.winter_tire_brand || null,
        winter_tire_measurements: formData.winter_tire_measurements || null,
        winter_tire_condition: formData.winter_tire_condition || null,
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
        tire_type: inventoryFormData.tire_type,
        quantity: inventoryFormData.quantity,
        notes: inventoryFormData.notes || null,
        on_rim: inventoryFormData.on_rim,
        bolt_pattern: inventoryFormData.on_rim && inventoryFormData.bolt_pattern ? inventoryFormData.bolt_pattern : null
      });

      if (error) throw error;

      toast({ title: 'Success', description: 'Tire added to inventory' });
      setInventoryDialogOpen(false);
      setInventoryFormData({ branch_id: '', brand: '', measurements: '', condition: 'good', tire_type: 'all_season', quantity: 1, notes: '', on_rim: false, bolt_pattern: '' });
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

  const openEditInventoryDialog = (item: TireInventoryItem) => {
    setEditingInventoryItem(item);
    setInventoryFormData({
      branch_id: item.branch_id,
      brand: item.brand,
      measurements: item.measurements,
      condition: item.condition as 'new' | 'good' | 'fair' | 'worn',
      tire_type: (item.tire_type as 'summer' | 'winter' | 'all_season') || 'all_season',
      quantity: item.quantity,
      notes: item.notes || '',
      on_rim: item.on_rim || false,
      bolt_pattern: (item.bolt_pattern as '' | '4_bolt' | '5_bolt' | '6_bolt' | '8_bolt') || ''
    });
    setEditInventoryDialogOpen(true);
  };

  const handleUpdateInventory = async () => {
    if (!editingInventoryItem || !inventoryFormData.branch_id || !inventoryFormData.brand || !inventoryFormData.measurements) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase.from('tire_inventory').update({
        branch_id: inventoryFormData.branch_id,
        brand: inventoryFormData.brand,
        measurements: inventoryFormData.measurements,
        condition: inventoryFormData.condition,
        tire_type: inventoryFormData.tire_type,
        quantity: inventoryFormData.quantity,
        notes: inventoryFormData.notes || null,
        on_rim: inventoryFormData.on_rim,
        bolt_pattern: inventoryFormData.on_rim && inventoryFormData.bolt_pattern ? inventoryFormData.bolt_pattern : null
      }).eq('id', editingInventoryItem.id);

      if (error) throw error;

      toast({ title: 'Success', description: 'Tire inventory updated' });
      setEditInventoryDialogOpen(false);
      setEditingInventoryItem(null);
      setInventoryFormData({ branch_id: '', brand: '', measurements: '', condition: 'good', tire_type: 'all_season', quantity: 1, notes: '', on_rim: false, bolt_pattern: '' });
      fetchData();
    } catch (error: any) {
      console.error('Error updating tire:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleClaimRequest = async () => {
    if (!selectedInventoryItem || !claimFormData.vehicle_id) {
      toast({ title: 'Error', description: 'Please select a vehicle', variant: 'destructive' });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('tire_claim_requests').insert({
        inventory_item_id: selectedInventoryItem.id,
        vehicle_id: claimFormData.vehicle_id,
        branch_id: claimFormData.branch_id || null,
        requested_by: user?.id,
        tire_type: claimFormData.tire_type,
        notes: claimFormData.notes || null
      });

      if (error) throw error;

      toast({ title: 'Success', description: 'Tire claim request submitted for admin approval' });
      setClaimDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error submitting claim:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleApproveClaimRequest = async (request: TireClaimRequest) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get the inventory item details
      const inventoryItem = tireInventory.find(i => i.id === request.inventory_item_id);
      if (!inventoryItem) throw new Error('Inventory item not found');

      // Update the claim request status
      const { error: claimError } = await supabase.from('tire_claim_requests').update({
        status: 'approved',
        approved_by: user?.id,
        approved_at: new Date().toISOString()
      }).eq('id', request.id);

      if (claimError) throw claimError;

      // Update the vehicle with the tire info
      const tireUpdate = request.tire_type === 'winter' 
        ? {
            winter_tire_brand: inventoryItem.brand,
            winter_tire_measurements: inventoryItem.measurements,
            winter_tire_condition: inventoryItem.condition
          }
        : {
            summer_tire_brand: inventoryItem.brand,
            summer_tire_measurements: inventoryItem.measurements,
            summer_tire_condition: inventoryItem.condition
          };

      const { error: vehicleError } = await supabase.from('vehicles')
        .update(tireUpdate)
        .eq('id', request.vehicle_id);

      if (vehicleError) throw vehicleError;

      // Remove the tire from inventory
      const { error: deleteError } = await supabase.from('tire_inventory')
        .delete()
        .eq('id', request.inventory_item_id);

      if (deleteError) throw deleteError;

      toast({ title: 'Success', description: 'Claim approved - tires assigned to vehicle and removed from inventory' });
      fetchData();
    } catch (error: any) {
      console.error('Error approving claim:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleRejectClaimRequest = async (requestId: string, reason?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('tire_claim_requests').update({
        status: 'rejected',
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
        rejection_reason: reason || 'Request rejected'
      }).eq('id', requestId);

      if (error) throw error;

      toast({ title: 'Request rejected' });
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

  const pendingClaims = claimRequests.filter(r => r.status === 'pending');

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

        {/* Pending Claims Alert for Admins */}
        {isAdmin && pendingClaims.length > 0 && (
          <Alert className="border-primary bg-primary/10">
            <Disc3 className="h-4 w-4" />
            <AlertTitle>{pendingClaims.length} Pending Tire Claim Request(s)</AlertTitle>
            <AlertDescription>
              Review and approve tire claims in the Claim Requests tab.
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
                {isAdmin && (
                  <TabsTrigger value="claims" className="relative">
                    Claim Requests
                    {pendingClaims.length > 0 && (
                      <Badge className="ml-2 bg-destructive">{pendingClaims.length}</Badge>
                    )}
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                {branches.map(branch => {
                  const branchVehicles = getVehiclesByBranch(branch.id);
                  const stats = getBranchComplianceStats(branch.id);
                  const isExpanded = expandedBranches.has(branch.id);

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
                                {branchVehicles.length === 0 ? (
                                  <Badge variant="outline">No vehicles</Badge>
                                ) : stats.compliant === stats.total ? (
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

                            {/* Vehicles with expandable tire details */}
                            <div className="space-y-2">
                              {branchVehicles.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-4 text-center">No vehicles assigned to this branch yet</p>
                              ) : branchVehicles.map(vehicle => {
                                const isVehicleExpanded = expandedVehicles.has(vehicle.id);
                                return (
                                  <div key={vehicle.id} className="border rounded-lg">
                                    <div 
                                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30"
                                      onClick={() => toggleVehicle(vehicle.id)}
                                    >
                                      <div className="flex items-center gap-3">
                                        {isVehicleExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                        <div>
                                          <p className="font-medium">{vehicle.make} {vehicle.model}</p>
                                          <p className="text-sm text-muted-foreground">{vehicle.plate}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {getTireStatusBadge(vehicle.current_tire_type)}
                                        <Button 
                                          size="sm" 
                                          variant="outline" 
                                          onClick={(e) => { e.stopPropagation(); openChangeDialog(vehicle); }}
                                        >
                                          Edit Tires
                                        </Button>
                                      </div>
                                    </div>
                                    
                                    {isVehicleExpanded && (
                                      <div className="px-3 pb-3 border-t bg-muted/20">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                                          {/* Summer Tires Info */}
                                          <div className="p-3 border rounded-lg bg-orange-500/5 border-orange-500/20">
                                            <div className="flex items-center gap-2 mb-2">
                                              <Sun className="h-4 w-4 text-orange-500" />
                                              <span className="font-medium">Summer Tires</span>
                                              {vehicle.current_tire_type === 'summer' && (
                                                <Badge className="bg-green-500 text-xs">On Vehicle</Badge>
                                              )}
                                            </div>
                                            <div className="space-y-1 text-sm">
                                              <p><span className="text-muted-foreground">Brand:</span> {vehicle.summer_tire_brand || '-'}</p>
                                              <p><span className="text-muted-foreground">Size:</span> {vehicle.summer_tire_measurements || '-'}</p>
                                              <p><span className="text-muted-foreground">Condition:</span> {getConditionBadge(vehicle.summer_tire_condition)}</p>
                                              <p><span className="text-muted-foreground">Location:</span> {vehicle.summer_tire_location || '-'}</p>
                                            </div>
                                          </div>

                                          {/* Winter Tires Info */}
                                          <div className="p-3 border rounded-lg bg-blue-500/5 border-blue-500/20">
                                            <div className="flex items-center gap-2 mb-2">
                                              <Snowflake className="h-4 w-4 text-blue-500" />
                                              <span className="font-medium">Winter Tires</span>
                                              {vehicle.current_tire_type === 'winter' && (
                                                <Badge className="bg-green-500 text-xs">On Vehicle</Badge>
                                              )}
                                            </div>
                                            <div className="space-y-1 text-sm">
                                              <p><span className="text-muted-foreground">Brand:</span> {vehicle.winter_tire_brand || '-'}</p>
                                              <p><span className="text-muted-foreground">Size:</span> {vehicle.winter_tire_measurements || '-'}</p>
                                              <p><span className="text-muted-foreground">Condition:</span> {getConditionBadge(vehicle.winter_tire_condition)}</p>
                                              <p><span className="text-muted-foreground">Location:</span> {vehicle.winter_tire_location || '-'}</p>
                                            </div>
                                          </div>
                                        </div>
                                        {vehicle.tire_notes && (
                                          <div className="mt-3 p-2 bg-muted rounded text-sm">
                                            <span className="text-muted-foreground">Notes:</span> {vehicle.tire_notes}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
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
                          <div className="space-y-2">
                            {getUnassignedVehicles().map(vehicle => {
                              const isVehicleExpanded = expandedVehicles.has(vehicle.id);
                              return (
                                <div key={vehicle.id} className="border rounded-lg">
                                  <div 
                                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30"
                                    onClick={() => toggleVehicle(vehicle.id)}
                                  >
                                    <div className="flex items-center gap-3">
                                      {isVehicleExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                      <div>
                                        <p className="font-medium">{vehicle.make} {vehicle.model}</p>
                                        <p className="text-sm text-muted-foreground">{vehicle.plate}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {getTireStatusBadge(vehicle.current_tire_type)}
                                      <Button 
                                        size="sm" 
                                        variant="outline" 
                                        onClick={(e) => { e.stopPropagation(); openChangeDialog(vehicle); }}
                                      >
                                        Edit Tires
                                      </Button>
                                    </div>
                                  </div>
                                  
                                  {isVehicleExpanded && (
                                    <div className="px-3 pb-3 border-t bg-muted/20">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                                        <div className="p-3 border rounded-lg bg-orange-500/5 border-orange-500/20">
                                          <div className="flex items-center gap-2 mb-2">
                                            <Sun className="h-4 w-4 text-orange-500" />
                                            <span className="font-medium">Summer Tires</span>
                                          </div>
                                          <div className="space-y-1 text-sm">
                                            <p><span className="text-muted-foreground">Brand:</span> {vehicle.summer_tire_brand || '-'}</p>
                                            <p><span className="text-muted-foreground">Size:</span> {vehicle.summer_tire_measurements || '-'}</p>
                                            <p><span className="text-muted-foreground">Condition:</span> {getConditionBadge(vehicle.summer_tire_condition)}</p>
                                          </div>
                                        </div>
                                        <div className="p-3 border rounded-lg bg-blue-500/5 border-blue-500/20">
                                          <div className="flex items-center gap-2 mb-2">
                                            <Snowflake className="h-4 w-4 text-blue-500" />
                                            <span className="font-medium">Winter Tires</span>
                                          </div>
                                          <div className="space-y-1 text-sm">
                                            <p><span className="text-muted-foreground">Brand:</span> {vehicle.winter_tire_brand || '-'}</p>
                                            <p><span className="text-muted-foreground">Size:</span> {vehicle.winter_tire_measurements || '-'}</p>
                                            <p><span className="text-muted-foreground">Condition:</span> {getConditionBadge(vehicle.winter_tire_condition)}</p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
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

              {isAdmin && (
                <TabsContent value="claims" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Tire Claim Requests</CardTitle>
                      <CardDescription>Review and approve requests to assign inventory tires to vehicles</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Tire Info</TableHead>
                            <TableHead>For Vehicle</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {claimRequests.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                No claim requests
                              </TableCell>
                            </TableRow>
                          ) : (
                            claimRequests.map(request => (
                              <TableRow key={request.id}>
                                <TableCell>{format(new Date(request.created_at), 'MMM d, yyyy')}</TableCell>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{request.tire_inventory?.brand}</p>
                                    <p className="text-xs text-muted-foreground">{request.tire_inventory?.measurements}</p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {request.vehicles?.make} {request.vehicles?.model} ({request.vehicles?.plate})
                                </TableCell>
                                <TableCell>
                                  {request.tire_type === 'winter' 
                                    ? <Badge className="bg-blue-500"><Snowflake className="h-3 w-3 mr-1" />Winter</Badge>
                                    : <Badge className="bg-orange-500"><Sun className="h-3 w-3 mr-1" />Summer</Badge>
                                  }
                                </TableCell>
                                <TableCell>
                                  {request.status === 'pending' && <Badge variant="outline">Pending</Badge>}
                                  {request.status === 'approved' && <Badge className="bg-green-500">Approved</Badge>}
                                  {request.status === 'rejected' && <Badge variant="destructive">Rejected</Badge>}
                                </TableCell>
                                <TableCell className="text-right">
                                  {request.status === 'pending' && (
                                    <div className="flex justify-end gap-2">
                                      <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="text-green-600"
                                        onClick={() => handleApproveClaimRequest(request)}
                                      >
                                        <Check className="h-4 w-4 mr-1" /> Approve
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="text-destructive"
                                        onClick={() => handleRejectClaimRequest(request.id)}
                                      >
                                        <X className="h-4 w-4 mr-1" /> Reject
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
          </div>

          {/* Sidebar - Tire Inventory */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Disc3 className="h-5 w-5" />
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
                      <Disc3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No spare tires in inventory</p>
                      <p className="text-sm">Add tires to track availability</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tireInventory.map(item => (
                        <div key={item.id} className="border rounded-lg p-3 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium">{item.brand}</p>
                              <p className="text-sm text-muted-foreground">{item.measurements}</p>
                              <p className="text-xs text-muted-foreground">{item.branches?.name}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {getTireStatusBadge(item.tire_type)}
                              {getConditionBadge(item.condition)}
                            </div>
                          </div>
                          {item.notes && (
                            <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">{item.notes}</p>
                          )}
                          <div className="flex gap-2">
                            {isAdminOrManager && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="flex-1"
                                onClick={() => openClaimDialog(item)}
                              >
                                <ArrowRight className="h-4 w-4 mr-1" /> Claim for Vehicle
                              </Button>
                            )}
                            {isAdmin && (
                              <>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-8 w-8"
                                  onClick={() => openEditInventoryDialog(item)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-8 w-8"
                                  onClick={() => handleDeleteInventory(item.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Record Tire Change Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Vehicle Tire Information</DialogTitle>
            </DialogHeader>
            {selectedVehicle && (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{selectedVehicle.make} {selectedVehicle.model}</p>
                  <p className="text-sm text-muted-foreground">Plate: {selectedVehicle.plate || 'N/A'}</p>
                </div>

                <div className="space-y-2">
                  <Label>Currently Installed Tires</Label>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Summer Tire Details */}
                  <div className="space-y-3 p-3 border rounded-lg bg-orange-500/5 border-orange-500/20">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4 text-orange-500" />
                      <Label className="font-medium">Summer Tire Details</Label>
                    </div>
                    <div className="space-y-2">
                      <Input 
                        placeholder="Brand (e.g., Michelin)"
                        value={formData.summer_tire_brand}
                        onChange={(e) => setFormData(prev => ({ ...prev, summer_tire_brand: e.target.value }))}
                      />
                      <Input 
                        placeholder="Size (e.g., 225/65R17)"
                        value={formData.summer_tire_measurements}
                        onChange={(e) => setFormData(prev => ({ ...prev, summer_tire_measurements: e.target.value }))}
                      />
                      <Select value={formData.summer_tire_condition} onValueChange={(v) => setFormData(prev => ({ ...prev, summer_tire_condition: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Condition" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="good">Good</SelectItem>
                          <SelectItem value="fair">Fair</SelectItem>
                          <SelectItem value="worn">Worn</SelectItem>
                        </SelectContent>
                      </Select>
                      <Textarea 
                        placeholder="Storage location"
                        value={formData.summer_tire_location}
                        onChange={(e) => setFormData(prev => ({ ...prev, summer_tire_location: e.target.value }))}
                        className="min-h-[60px]"
                      />
                    </div>
                  </div>

                  {/* Winter Tire Details */}
                  <div className="space-y-3 p-3 border rounded-lg bg-blue-500/5 border-blue-500/20">
                    <div className="flex items-center gap-2">
                      <Snowflake className="h-4 w-4 text-blue-500" />
                      <Label className="font-medium">Winter Tire Details</Label>
                    </div>
                    <div className="space-y-2">
                      <Input 
                        placeholder="Brand (e.g., Blizzak)"
                        value={formData.winter_tire_brand}
                        onChange={(e) => setFormData(prev => ({ ...prev, winter_tire_brand: e.target.value }))}
                      />
                      <Input 
                        placeholder="Size (e.g., 225/65R17)"
                        value={formData.winter_tire_measurements}
                        onChange={(e) => setFormData(prev => ({ ...prev, winter_tire_measurements: e.target.value }))}
                      />
                      <Select value={formData.winter_tire_condition} onValueChange={(v) => setFormData(prev => ({ ...prev, winter_tire_condition: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Condition" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="good">Good</SelectItem>
                          <SelectItem value="fair">Fair</SelectItem>
                          <SelectItem value="worn">Worn</SelectItem>
                        </SelectContent>
                      </Select>
                      <Textarea 
                        placeholder="Storage location"
                        value={formData.winter_tire_location}
                        onChange={(e) => setFormData(prev => ({ ...prev, winter_tire_location: e.target.value }))}
                        className="min-h-[60px]"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Additional Notes</Label>
                  <Textarea 
                    placeholder="Any additional notes about this vehicle's tires..."
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleTireChange}>Save Changes</Button>
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
                <Label>Tire Type *</Label>
                <Select value={inventoryFormData.tire_type} onValueChange={(v) => setInventoryFormData(prev => ({ ...prev, tire_type: v as any }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="summer"><Sun className="h-4 w-4 inline mr-2" /> Summer</SelectItem>
                    <SelectItem value="winter"><Snowflake className="h-4 w-4 inline mr-2" /> Winter</SelectItem>
                    <SelectItem value="all_season"><Car className="h-4 w-4 inline mr-2" /> All Season</SelectItem>
                  </SelectContent>
                </Select>
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
                <Label>Rim Status</Label>
                <Select value={inventoryFormData.on_rim ? 'on_rim' : 'off_rim'} onValueChange={(v) => setInventoryFormData(prev => ({ ...prev, on_rim: v === 'on_rim', bolt_pattern: v === 'off_rim' ? '' : prev.bolt_pattern }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off_rim">Off Rim</SelectItem>
                    <SelectItem value="on_rim">On Rim</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {inventoryFormData.on_rim && (
                <div className="space-y-2">
                  <Label>Bolt Pattern</Label>
                  <Select value={inventoryFormData.bolt_pattern} onValueChange={(v) => setInventoryFormData(prev => ({ ...prev, bolt_pattern: v as any }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select bolt pattern" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4_bolt">4 Bolt</SelectItem>
                      <SelectItem value="5_bolt">5 Bolt</SelectItem>
                      <SelectItem value="6_bolt">6 Bolt</SelectItem>
                      <SelectItem value="8_bolt">8 Bolt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

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

        {/* Claim Tire Dialog */}
        <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Claim Tire for Vehicle</DialogTitle>
            </DialogHeader>
            {selectedInventoryItem && (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{selectedInventoryItem.brand}</p>
                  <p className="text-sm text-muted-foreground">{selectedInventoryItem.measurements} • {selectedInventoryItem.condition}</p>
                  <p className="text-xs text-muted-foreground">From: {selectedInventoryItem.branches?.name}</p>
                </div>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    This request will be sent to an admin for approval. Once approved, the tire will be assigned to the selected vehicle and removed from inventory.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label>Assign to Vehicle *</Label>
                  <Select value={claimFormData.vehicle_id} onValueChange={(v) => {
                    const vehicle = vehicles.find(vh => vh.id === v);
                    setClaimFormData(prev => ({ 
                      ...prev, 
                      vehicle_id: v,
                      branch_id: vehicle?.branch_id || ''
                    }));
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map(vehicle => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.make} {vehicle.model} ({vehicle.plate})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tire Set Type *</Label>
                  <Select value={claimFormData.tire_type} onValueChange={(v) => setClaimFormData(prev => ({ ...prev, tire_type: v as 'winter' | 'summer' }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="summer"><Sun className="h-4 w-4 inline mr-2" /> Summer Tires</SelectItem>
                      <SelectItem value="winter"><Snowflake className="h-4 w-4 inline mr-2" /> Winter Tires</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea 
                    placeholder="Reason for claim or additional info..."
                    value={claimFormData.notes}
                    onChange={(e) => setClaimFormData(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setClaimDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleClaimRequest}>Submit for Approval</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Tire Inventory Dialog - Admin Only */}
        <Dialog open={editInventoryDialogOpen} onOpenChange={(open) => {
          setEditInventoryDialogOpen(open);
          if (!open) {
            setEditingInventoryItem(null);
            setInventoryFormData({ branch_id: '', brand: '', measurements: '', condition: 'good', tire_type: 'all_season', quantity: 1, notes: '', on_rim: false, bolt_pattern: '' });
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Tire Inventory</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Branch *</Label>
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
                  placeholder="e.g., Michelin, Goodyear"
                  value={inventoryFormData.brand}
                  onChange={(e) => setInventoryFormData(prev => ({ ...prev, brand: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Measurements *</Label>
                <Input 
                  placeholder="e.g., 225/65R17"
                  value={inventoryFormData.measurements}
                  onChange={(e) => setInventoryFormData(prev => ({ ...prev, measurements: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Tire Type *</Label>
                <Select value={inventoryFormData.tire_type} onValueChange={(v) => setInventoryFormData(prev => ({ ...prev, tire_type: v as any }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="summer"><Sun className="h-4 w-4 inline mr-2" /> Summer</SelectItem>
                    <SelectItem value="winter"><Snowflake className="h-4 w-4 inline mr-2" /> Winter</SelectItem>
                    <SelectItem value="all_season"><Car className="h-4 w-4 inline mr-2" /> All Season</SelectItem>
                  </SelectContent>
                </Select>
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
                <Label>Rim Status</Label>
                <Select value={inventoryFormData.on_rim ? 'on_rim' : 'off_rim'} onValueChange={(v) => setInventoryFormData(prev => ({ ...prev, on_rim: v === 'on_rim', bolt_pattern: v === 'off_rim' ? '' : prev.bolt_pattern }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off_rim">Off Rim</SelectItem>
                    <SelectItem value="on_rim">On Rim</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {inventoryFormData.on_rim && (
                <div className="space-y-2">
                  <Label>Bolt Pattern</Label>
                  <Select value={inventoryFormData.bolt_pattern} onValueChange={(v) => setInventoryFormData(prev => ({ ...prev, bolt_pattern: v as any }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select bolt pattern" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4_bolt">4 Bolt</SelectItem>
                      <SelectItem value="5_bolt">5 Bolt</SelectItem>
                      <SelectItem value="6_bolt">6 Bolt</SelectItem>
                      <SelectItem value="8_bolt">8 Bolt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input 
                  type="number"
                  min={1}
                  value={inventoryFormData.quantity}
                  onChange={(e) => setInventoryFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea 
                  placeholder="Additional info about these tires..."
                  value={inventoryFormData.notes}
                  onChange={(e) => setInventoryFormData(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditInventoryDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleUpdateInventory}>Save Changes</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
