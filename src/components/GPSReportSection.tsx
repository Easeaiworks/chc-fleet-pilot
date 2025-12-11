import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useToast } from '@/hooks/use-toast';
import { Navigation, Check, AlertCircle, CalendarIcon, Trash2 } from 'lucide-react';
import { format, endOfMonth, isWithinInterval } from 'date-fns';
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

export function GPSReportSection() {
  const [uploads, setUploads] = useState<GPSUpload[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterVehicle, setFilterVehicle] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'date' | 'vehicle' | 'km'>('date');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteType, setDeleteType] = useState<'selected' | 'all'>('selected');
  
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

  // Filter and sort uploads
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
        const from = dateRange.from;
        const to = dateRange.to || dateRange.from;
        return isWithinInterval(uploadDate, { start: from, end: endOfMonth(to) });
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'vehicle':
          const nameA = a.vehicles?.plate || a.gps_vehicle_name || '';
          const nameB = b.vehicles?.plate || b.gps_vehicle_name || '';
          return nameA.localeCompare(nameB);
        case 'km':
          return b.kilometers - a.kilometers;
        case 'date':
        default:
          return new Date(b.upload_month).getTime() - new Date(a.upload_month).getTime();
      }
    });

  const totalKilometers = filteredUploads.reduce((sum, u) => sum + Number(u.kilometers), 0);
  const matchedCount = filteredUploads.filter(u => u.vehicle_id).length;
  const unmatchedCount = filteredUploads.filter(u => !u.vehicle_id).length;

  const handleSelectAll = () => {
    if (selectedIds.size === filteredUploads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredUploads.map(u => u.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
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

  return (
    <>
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Navigation className="h-5 w-5" />
              GPS Mileage Report
            </CardTitle>
            {isAdminOrManager && (
              <div className="flex items-center gap-2">
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
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Total Kilometers</p>
              <p className="text-2xl font-bold">{totalKilometers.toLocaleString()} km</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Entries</p>
              <p className="text-2xl font-bold">{filteredUploads.length}</p>
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
                          {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
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
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="vehicle">Vehicle</SelectItem>
                  <SelectItem value="km">Kilometers</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading GPS data...</p>
          ) : filteredUploads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Navigation className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No GPS data found</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isAdminOrManager && (
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedIds.size === filteredUploads.length && filteredUploads.length > 0}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all"
                        />
                      </TableHead>
                    )}
                    <TableHead>Month</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>GPS Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Kilometers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUploads.map((upload) => (
                    <TableRow 
                      key={upload.id}
                      className={selectedIds.has(upload.id) ? 'bg-primary/5' : ''}
                    >
                      {isAdminOrManager && (
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(upload.id)}
                            onCheckedChange={() => handleSelectOne(upload.id)}
                            aria-label={`Select ${upload.gps_vehicle_name}`}
                          />
                        </TableCell>
                      )}
                      <TableCell>{format(new Date(upload.upload_month), 'MMMM yyyy')}</TableCell>
                      <TableCell>
                        {upload.vehicles ? (
                          `${upload.vehicles.make || ''} ${upload.vehicles.model || ''} (${upload.vehicles.plate})`
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {upload.gps_vehicle_name || '—'}
                      </TableCell>
                      <TableCell>
                        {upload.vehicle_id ? (
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
                      <TableCell className="text-right font-medium">
                        {Number(upload.kilometers).toLocaleString()} km
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={isAdminOrManager ? 5 : 4} className="font-semibold">Total</TableCell>
                    <TableCell className="text-right font-bold">
                      {totalKilometers.toLocaleString()} km
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
