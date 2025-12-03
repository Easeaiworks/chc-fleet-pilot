import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Navigation, Check, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

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
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'vehicle' | 'km'>('date');

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

  // Get unique months from uploads
  const uniqueMonths = [...new Set(uploads.map(u => format(new Date(u.upload_month), 'yyyy-MM')))].sort().reverse();

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
      if (filterMonth !== 'all') {
        return format(new Date(u.upload_month), 'yyyy-MM') === filterMonth;
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

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Navigation className="h-5 w-5" />
          GPS Mileage Report
        </CardTitle>
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
            <Label>Filter by Month</Label>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="All months" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                <SelectItem value="all">All Months</SelectItem>
                {uniqueMonths.map((month) => (
                  <SelectItem key={month} value={month}>
                    {format(new Date(month + '-01'), 'MMMM yyyy')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                  <TableHead>Month</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>GPS Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Kilometers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUploads.map((upload) => (
                  <TableRow key={upload.id}>
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
                  <TableCell colSpan={4} className="font-semibold">Total</TableCell>
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
  );
}
