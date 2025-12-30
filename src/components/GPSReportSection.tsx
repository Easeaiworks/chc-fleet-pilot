import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useToast } from '@/hooks/use-toast';
import { Navigation, Check, AlertCircle, CalendarIcon, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { format, endOfMonth, isWithinInterval, startOfMonth, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface GPSUpload {
  id: string;
  file_name: string;
  upload_month: string;
  kilometers: number;
  created_at: string;
  vehicle_id: string | null;
  gps_vehicle_name: string | null;
  vehicles?: { plate: string; make: string | null; model: string | null } | null;
}

interface Vehicle {
  id: string;
  plate: string;
  make: string | null;
  model: string | null;
}

interface VehicleGroup {
  vehicleId: string | null;
  vehicleName: string;
  gpsName: string | null;
  isMatched: boolean;
  totalKilometers: number;
  uploads: GPSUpload[];
}

export function GPSReportSection() {
  const [uploads, setUploads] = useState<GPSUpload[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterVehicle, setFilterVehicle] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'vehicle' | 'km'>('km');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteType, setDeleteType] = useState<'selected' | 'all'>('selected');
  const [expandedVehicles, setExpandedVehicles] = useState<Set<string>>(new Set());
  
  const { isAdmin, isAdminOrManager } = useUserRole();
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [uploadsRes, vehiclesRes] = await Promise.all([
      supabase
        .from('gps_uploads')
        .select(`
          *,
          vehicles (plate, make, model)
        `)
        .order('upload_month', { ascending: false }),
      supabase.from('vehicles').select('id, plate, make, model').order('plate')
    ]);

    if (uploadsRes.data) setUploads(uploadsRes.data);
    if (vehiclesRes.data) setVehicles(vehiclesRes.data);
    setLoading(false);
  };

  // Filter uploads based on vehicle and date range
  const filteredUploads = uploads
    .filter(u => {
      if (filterVehicle !== 'all') {
        if (filterVehicle === 'unmatched') return !u.vehicle_id;
        return u.vehicle_id === filterVehicle;
      }
      return true;
    })
    .filter(u => {
      if (dateRange?.from) {
        const uploadDate = new Date(u.upload_month);
        const from = startOfMonth(dateRange.from);
        const to = dateRange.to ? endOfMonth(dateRange.to) : endOfMonth(dateRange.from);
        return isWithinInterval(uploadDate, { start: from, end: to });
      }
      return true;
    });

  // Group uploads by vehicle
  const vehicleGroups: VehicleGroup[] = (() => {
    const groupMap = new Map<string, VehicleGroup>();
    
    filteredUploads.forEach(upload => {
      const key = upload.vehicle_id || `unmatched-${upload.gps_vehicle_name}`;
      const existing = groupMap.get(key);
      
      if (existing) {
        existing.totalKilometers += Number(upload.kilometers);
        existing.uploads.push(upload);
      } else {
        const vehicleName = upload.vehicles 
          ? `${upload.vehicles.make || ''} ${upload.vehicles.model || ''} (${upload.vehicles.plate})`
          : upload.gps_vehicle_name || 'Unknown';
        
        groupMap.set(key, {
          vehicleId: upload.vehicle_id,
          vehicleName,
          gpsName: upload.gps_vehicle_name,
          isMatched: !!upload.vehicle_id,
          totalKilometers: Number(upload.kilometers),
          uploads: [upload],
        });
      }
    });
    
    // Sort each group's uploads by date
    groupMap.forEach(group => {
      group.uploads.sort((a, b) => new Date(b.upload_month).getTime() - new Date(a.upload_month).getTime());
    });
    
    // Sort groups
    return Array.from(groupMap.values()).sort((a, b) => {
      if (sortBy === 'km') {
        return b.totalKilometers - a.totalKilometers;
      }
      return a.vehicleName.localeCompare(b.vehicleName);
    });
  })();

  const totalKilometers = filteredUploads.reduce((sum, u) => sum + Number(u.kilometers), 0);
  const matchedCount = vehicleGroups.filter(g => g.isMatched).length;
  const unmatchedCount = vehicleGroups.filter(g => !g.isMatched).length;

  const toggleExpanded = (key: string) => {
    const newExpanded = new Set(expandedVehicles);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedVehicles(newExpanded);
  };

  const handleSelectUpload = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectVehicleGroup = (group: VehicleGroup) => {
    const groupIds = new Set(group.uploads.map(u => u.id));
    const allSelected = group.uploads.every(u => selectedIds.has(u.id));
    
    const newSelected = new Set(selectedIds);
    if (allSelected) {
      groupIds.forEach(id => newSelected.delete(id));
    } else {
      groupIds.forEach(id => newSelected.add(id));
    }
    setSelectedIds(newSelected);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    setDeleteType('selected');
    setShowDeleteDialog(true);
  };

  const handleDeleteAll = () => {
    setDeleteType('all');
    setShowDeleteDialog(true);
  };

  const performDelete = async () => {
    setIsDeleting(true);
    
    try {
      const idsToDelete = deleteType === 'all' 
        ? uploads.map(u => u.id) 
        : Array.from(selectedIds);
      
      const uploadsToDelete = uploads.filter(u => idsToDelete.includes(u.id));
      
      // Group by vehicle_id for odometer updates
      const vehicleKmMap = new Map<string, number>();
      for (const upload of uploadsToDelete) {
        if (upload.vehicle_id) {
          const current = vehicleKmMap.get(upload.vehicle_id) || 0;
          vehicleKmMap.set(upload.vehicle_id, current + upload.kilometers);
        }
      }
      
      // Delete GPS records
      const { error } = await supabase
        .from('gps_uploads')
        .delete()
        .in('id', idsToDelete);
      
      if (error) throw error;
      
      // Update vehicle odometers
      for (const [vehicleId, kmToSubtract] of vehicleKmMap) {
        const { data: vehicle } = await supabase
          .from('vehicles')
          .select('odometer_km')
          .eq('id', vehicleId)
          .single();
        
        if (vehicle) {
          await supabase
            .from('vehicles')
            .update({ odometer_km: Math.max(0, (vehicle.odometer_km || 0) - kmToSubtract) })
            .eq('id', vehicleId);
        }
      }
      
      const totalKmDeleted = uploadsToDelete.reduce((sum, u) => sum + Number(u.kilometers), 0);
      
      toast({
        title: 'GPS Data Deleted',
        description: `Removed ${uploadsToDelete.length} entries (${totalKmDeleted.toLocaleString()} km total)`,
      });
      
      setSelectedIds(new Set());
      fetchData();
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'Delete Failed',
        description: 'Failed to delete GPS data',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const selectedKilometers = filteredUploads
    .filter(u => selectedIds.has(u.id))
    .reduce((sum, u) => sum + Number(u.kilometers), 0);

  // Quick month filter buttons
  const setMonthFilter = (monthsBack: number) => {
    const now = new Date();
    const from = startOfMonth(subMonths(now, monthsBack));
    const to = monthsBack === 0 ? endOfMonth(now) : endOfMonth(subMonths(now, monthsBack));
    setDateRange({ from, to });
  };

  return (
    <>
      <div className="space-y-4">
        {/* Admin actions */}
        {isAdminOrManager && (
          <div className="flex items-center justify-end gap-2">
            {selectedIds.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteSelected}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete Selected ({selectedIds.size})
              </Button>
            )}
            {isAdmin && uploads.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteAll}
                disabled={isDeleting}
                className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete All
              </Button>
            )}
          </div>
        )}
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Total Kilometers</p>
              <p className="text-2xl font-bold">{totalKilometers.toLocaleString()} km</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vehicles</p>
              <p className="text-2xl font-bold">{vehicleGroups.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Matched</p>
              <p className="text-2xl font-bold text-green-600">{matchedCount}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Unmatched</p>
              <p className="text-2xl font-bold text-amber-600">{unmatchedCount}</p>
            </div>
          </div>

          {/* Selection info */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
              <span className="text-sm">
                {selectedIds.size} selected ({selectedKilometers.toLocaleString()} km)
              </span>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                Clear selection
              </Button>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Label>Filter by Vehicle</Label>
                <Select value={filterVehicle} onValueChange={setFilterVehicle}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="All vehicles" />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    <SelectItem value="all">All Vehicles</SelectItem>
                    <SelectItem value="unmatched">Unmatched Only</SelectItem>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.make} {v.model} ({v.plate})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label>Filter by Date Range</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-background",
                        !dateRange && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "LLL yyyy")} - {format(dateRange.to, "LLL yyyy")}
                          </>
                        ) : (
                          format(dateRange.from, "LLL yyyy")
                        )
                      ) : (
                        <span>All dates</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                      className="pointer-events-auto"
                    />
                    {dateRange && (
                      <div className="p-2 border-t">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full"
                          onClick={() => setDateRange(undefined)}
                        >
                          Clear filter
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex-1">
                <Label>Sort by</Label>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    <SelectItem value="km">Kilometers</SelectItem>
                    <SelectItem value="vehicle">Vehicle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Quick month filters */}
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setMonthFilter(0)}
                className={cn(
                  dateRange?.from && format(dateRange.from, 'yyyy-MM') === format(new Date(), 'yyyy-MM') && "bg-primary text-primary-foreground"
                )}
              >
                This Month
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setMonthFilter(1)}
              >
                Last Month
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setMonthFilter(2)}
              >
                2 Months Ago
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setMonthFilter(3)}
              >
                3 Months Ago
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setDateRange(undefined)}
                className={cn(!dateRange && "bg-primary text-primary-foreground")}
              >
                All Time
              </Button>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading GPS data...</p>
          ) : vehicleGroups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Navigation className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No GPS data found</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    {isAdminOrManager && <TableHead className="w-12"></TableHead>}
                    <TableHead>Vehicle</TableHead>
                    <TableHead>GPS Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Uploads</TableHead>
                    <TableHead className="text-right">Total Kilometers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicleGroups.map((group) => {
                    const key = group.vehicleId || `unmatched-${group.gpsName}`;
                    const isExpanded = expandedVehicles.has(key);
                    const allGroupSelected = group.uploads.every(u => selectedIds.has(u.id));
                    const someGroupSelected = group.uploads.some(u => selectedIds.has(u.id));
                    
                    return (
                      <Collapsible key={key} open={isExpanded} onOpenChange={() => toggleExpanded(key)} asChild>
                        <>
                          <TableRow className="bg-muted/30 hover:bg-muted/50">
                            <TableCell>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                            </TableCell>
                            {isAdminOrManager && (
                              <TableCell>
                                <Checkbox
                                  checked={allGroupSelected}
                                  ref={(el) => {
                                    if (el) {
                                      (el as any).indeterminate = someGroupSelected && !allGroupSelected;
                                    }
                                  }}
                                  onCheckedChange={() => handleSelectVehicleGroup(group)}
                                  aria-label={`Select all for ${group.vehicleName}`}
                                />
                              </TableCell>
                            )}
                            <TableCell className="font-medium">{group.vehicleName}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {group.gpsName || '—'}
                            </TableCell>
                            <TableCell>
                              {group.isMatched ? (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                  <Check className="h-3 w-3 mr-1" />
                                  Matched
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-amber-600 border-amber-600">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Unmatched
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">{group.uploads.length}</TableCell>
                            <TableCell className="text-right font-bold">
                              {group.totalKilometers.toLocaleString()} km
                            </TableCell>
                          </TableRow>
                          <CollapsibleContent asChild>
                            <>
                              {group.uploads.map((upload) => (
                                <TableRow 
                                  key={upload.id}
                                  className={cn(
                                    "bg-background",
                                    selectedIds.has(upload.id) && "bg-primary/5"
                                  )}
                                >
                                  <TableCell></TableCell>
                                  {isAdminOrManager && (
                                    <TableCell>
                                      <Checkbox
                                        checked={selectedIds.has(upload.id)}
                                        onCheckedChange={() => handleSelectUpload(upload.id)}
                                        aria-label={`Select ${upload.file_name}`}
                                      />
                                    </TableCell>
                                  )}
                                  <TableCell className="pl-8 text-muted-foreground text-sm">
                                    {format(new Date(upload.upload_month), 'MMMM yyyy')}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground text-xs">
                                    {upload.file_name}
                                  </TableCell>
                                  <TableCell></TableCell>
                                  <TableCell></TableCell>
                                  <TableCell className="text-right text-sm">
                                    {Number(upload.kilometers).toLocaleString()} km
                                  </TableCell>
                                </TableRow>
                              ))}
                            </>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={isAdminOrManager ? 6 : 5} className="font-semibold">Total</TableCell>
                    <TableCell className="text-right font-bold">
                      {totalKilometers.toLocaleString()} km
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteType === 'all' ? 'Delete All GPS Data?' : 'Delete Selected GPS Data?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteType === 'all' ? (
                <>
                  This will permanently delete <strong>all {uploads.length} GPS entries</strong> and subtract the corresponding kilometers from vehicle odometers.
                  <br /><br />
                  <strong className="text-destructive">This action cannot be undone.</strong>
                </>
              ) : (
                <>
                  This will permanently delete <strong>{selectedIds.size} GPS entries</strong> ({selectedKilometers.toLocaleString()} km) and subtract the corresponding kilometers from vehicle odometers.
                  <br /><br />
                  <strong className="text-destructive">This action cannot be undone.</strong>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={performDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
