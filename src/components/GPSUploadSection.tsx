import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, Trash2, Navigation, Check, AlertCircle } from 'lucide-react';
import { format, parse } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface GPSUpload {
  id: string;
  file_name: string;
  upload_month: string;
  kilometers: number;
  created_at: string;
  notes: string | null;
  vehicle_id: string | null;
  gps_vehicle_name: string | null;
}

interface GPSUploadSectionProps {
  vehicleId?: string;
  onKilometersUpdated?: () => void;
}

interface ParsedVehicleEntry {
  vehicleName: string;
  kilometers: number;
}

interface ParsedGPSResult {
  entries: ParsedVehicleEntry[];
  dateFrom: Date | null;
  dateTo: Date | null;
}

interface Vehicle {
  id: string;
  plate: string;
  vin: string;
  make: string | null;
  model: string | null;
}

export function GPSUploadSection({ vehicleId, onKilometersUpdated }: GPSUploadSectionProps) {
  const [uploads, setUploads] = useState<GPSUpload[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const { toast } = useToast();

  useEffect(() => {
    fetchUploads();
  }, [vehicleId]);

  const fetchUploads = async () => {
    setLoading(true);
    let query = supabase
      .from('gps_uploads')
      .select('*')
      .order('upload_month', { ascending: false });
    
    if (vehicleId) {
      query = query.eq('vehicle_id', vehicleId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching GPS uploads:', error);
    } else {
      setUploads(data || []);
    }
    setLoading(false);
  };

  const parseGPSFile = async (file: File): Promise<ParsedGPSResult> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());
          
          if (lines.length < 4) {
            reject(new Error('File appears to be empty or invalid'));
            return;
          }

          const entries: ParsedVehicleEntry[] = [];
          let dateFrom: Date | null = null;
          let dateTo: Date | null = null;
          
          // Parse date range from line 2 (format: "From:2025-10-01 00:00  To：2025-12-04 00:00")
          if (lines.length >= 2) {
            const dateLine = lines[1];
            // Match patterns like "From:2025-10-01" or "From：2025-10-01" (both colon types)
            const fromMatch = dateLine.match(/From[:：]\s*(\d{4}-\d{2}-\d{2})/i);
            const toMatch = dateLine.match(/To[:：]\s*(\d{4}-\d{2}-\d{2})/i);
            
            if (fromMatch) {
              dateFrom = parse(fromMatch[1], 'yyyy-MM-dd', new Date());
            }
            if (toMatch) {
              dateTo = parse(toMatch[1], 'yyyy-MM-dd', new Date());
            }
          }
          
          // Find the header row (contains "Target Name" or "Mileage" or "No.")
          let dataStartIndex = 0;
          for (let i = 0; i < Math.min(lines.length, 10); i++) {
            const lowerLine = lines[i].toLowerCase();
            if (lowerLine.includes('target name') || lowerLine.includes('mileage') || 
                (lowerLine.includes('no.') && lowerLine.includes(','))) {
              dataStartIndex = i + 1;
              break;
            }
          }
          
          // If no header found, skip first 3 rows (title, date range, headers)
          if (dataStartIndex === 0) {
            dataStartIndex = 3;
          }
          
          // Parse data rows
          // Column B (index 1) = vehicle name, Column C (index 2) = kilometers
          for (let i = dataStartIndex; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            
            // Column B is index 1, Column C is index 2
            const vehicleName = values[1];
            const kmValue = values[2];
            
            if (vehicleName) {
              // Skip header-like rows
              if (vehicleName.toLowerCase() === 'target name' || (kmValue && kmValue.toLowerCase().includes('mileage'))) {
                continue;
              }
              
              // Parse kilometers - treat empty/invalid as 0 to record vehicles with no movement
              const km = kmValue ? parseFloat(kmValue.replace(/[^0-9.-]/g, '')) : 0;
              const finalKm = isNaN(km) ? 0 : Math.max(0, km); // Ensure non-negative
              
              entries.push({
                vehicleName: vehicleName.trim(),
                kilometers: finalKm
              });
            }
          }

          if (entries.length === 0) {
            reject(new Error('Could not find vehicle/kilometer data. Expected vehicle names in column B and kilometers in column C.'));
            return;
          }

          resolve({ entries, dateFrom, dateTo });
        } catch (error) {
          reject(new Error('Failed to parse file'));
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const matchVehicle = (gpsName: string, vehicles: Vehicle[]): Vehicle | null => {
    const normalizedGpsName = gpsName.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    for (const vehicle of vehicles) {
      // Try matching by plate
      const normalizedPlate = vehicle.plate.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedGpsName.includes(normalizedPlate) || normalizedPlate.includes(normalizedGpsName)) {
        return vehicle;
      }
      
      // Try matching by VIN (last 6 characters often used)
      const vinSuffix = vehicle.vin.slice(-6).toLowerCase();
      if (normalizedGpsName.includes(vinSuffix)) {
        return vehicle;
      }
      
      // Try matching by make/model combination
      if (vehicle.make && vehicle.model) {
        const makeModel = `${vehicle.make}${vehicle.model}`.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalizedGpsName.includes(makeModel) || makeModel.includes(normalizedGpsName)) {
          return vehicle;
        }
      }
    }
    
    return null;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = ['.csv', '.xls', '.xlsx', '.xltx'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!validTypes.includes(fileExtension)) {
      toast({
        title: 'Invalid File',
        description: 'Please upload a CSV or Excel file',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      // Get all vehicles for matching
      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('id, plate, vin, make, model');

      // Parse the file to extract vehicle entries and date range
      let parsedResult: ParsedGPSResult;
      
      if (fileExtension === '.csv') {
        parsedResult = await parseGPSFile(file);
      } else {
        toast({
          title: 'Excel File Detected',
          description: 'Please save as CSV for automatic parsing',
          variant: 'destructive',
        });
        setUploading(false);
        event.target.value = '';
        return;
      }

      const { entries, dateFrom, dateTo } = parsedResult;
      
      // Use the "From" date from the file, or fall back to selected month
      const uploadDate = dateFrom || parse(selectedMonth, 'yyyy-MM', new Date());
      const uploadMonthStr = format(uploadDate, 'yyyy-MM-dd');

      // Upload file to storage
      const filePath = `gps/${format(uploadDate, 'yyyy-MM')}-${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('vehicle-documents')
        .upload(filePath, file);

      if (uploadError) {
        throw new Error('Failed to upload file');
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      let matchedCount = 0;
      let unmatchedCount = 0;
      let totalKm = 0;

      // Process each entry
      for (const entry of entries) {
        const matchedVehicle = vehicles ? matchVehicle(entry.vehicleName, vehicles) : null;
        
        // Create database record
        const { error: dbError } = await supabase
          .from('gps_uploads')
          .insert({
            vehicle_id: matchedVehicle?.id || null,
            file_name: file.name,
            file_path: filePath,
            upload_month: uploadMonthStr,
            kilometers: entry.kilometers,
            uploaded_by: user?.id,
            gps_vehicle_name: entry.vehicleName,
          });

        if (dbError) {
          console.error('Error saving GPS entry:', dbError);
          continue;
        }

        totalKm += entry.kilometers;

        // Update vehicle odometer if matched
        if (matchedVehicle) {
          matchedCount++;
          const { data: vehicle } = await supabase
            .from('vehicles')
            .select('odometer_km')
            .eq('id', matchedVehicle.id)
            .single();

          if (vehicle) {
            await supabase
              .from('vehicles')
              .update({ odometer_km: (vehicle.odometer_km || 0) + entry.kilometers })
              .eq('id', matchedVehicle.id);
          }
        } else {
          unmatchedCount++;
        }
      }

      const dateRangeText = dateFrom && dateTo 
        ? ` (${format(dateFrom, 'MMM d')} - ${format(dateTo, 'MMM d, yyyy')})`
        : '';
      
      toast({
        title: 'GPS Data Uploaded',
        description: `Processed ${entries.length} vehicles${dateRangeText}: ${matchedCount} matched, ${unmatchedCount} unmatched. Total: ${totalKm.toLocaleString()} km`,
      });

      fetchUploads();
      onKilometersUpdated?.();
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload GPS data',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleDelete = async (upload: GPSUpload) => {
    const confirmMsg = upload.vehicle_id 
      ? `Delete GPS data for ${upload.gps_vehicle_name || 'this vehicle'}? This will subtract ${upload.kilometers.toLocaleString()} km from the vehicle's odometer.`
      : `Delete GPS data for ${upload.gps_vehicle_name}?`;
    
    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      // Delete from database
      const { error: dbError } = await supabase
        .from('gps_uploads')
        .delete()
        .eq('id', upload.id);

      if (dbError) throw dbError;

      // Subtract kilometers from vehicle if matched
      if (upload.vehicle_id) {
        const { data: vehicle } = await supabase
          .from('vehicles')
          .select('odometer_km')
          .eq('id', upload.vehicle_id)
          .single();

        if (vehicle) {
          await supabase
            .from('vehicles')
            .update({ odometer_km: Math.max(0, (vehicle.odometer_km || 0) - upload.kilometers) })
            .eq('id', upload.vehicle_id);
        }
      }

      toast({
        title: 'Deleted',
        description: 'GPS data has been removed',
      });

      fetchUploads();
      onKilometersUpdated?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete GPS data',
        variant: 'destructive',
      });
    }
  };

  const totalGPSKilometers = uploads.reduce((sum, u) => sum + Number(u.kilometers), 0);
  const matchedUploads = uploads.filter(u => u.vehicle_id);
  const unmatchedUploads = uploads.filter(u => !u.vehicle_id);

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Navigation className="h-5 w-5" />
          GPS Mileage Tracker
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Total Kilometers</p>
            <p className="text-2xl font-bold">{totalGPSKilometers.toLocaleString()} km</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Entries</p>
            <p className="text-2xl font-bold">{uploads.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Matched</p>
            <p className="text-2xl font-bold text-green-600">{matchedUploads.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Unmatched</p>
            <p className="text-2xl font-bold text-amber-600">{unmatchedUploads.length}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Label htmlFor="upload-month">Month</Label>
            <Input
              id="upload-month"
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Label htmlFor="gps-file" className="cursor-pointer">
              <Button asChild disabled={uploading}>
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Upload GPS File'}
                </span>
              </Button>
              <Input
                id="gps-file"
                type="file"
                accept=".csv,.xls,.xlsx,.xltx"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </Label>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Upload a CSV with vehicle names in column B and kilometers in column C. 
          Vehicles will be automatically matched by plate, VIN, or make/model.
        </p>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading uploads...</p>
        ) : uploads.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <FileSpreadsheet className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No GPS files uploaded yet</p>
            <p className="text-xs">Upload a CSV file with mileage data</p>
          </div>
        ) : (
          <div className="space-y-2">
            {uploads.map((upload) => (
              <div
                key={upload.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {upload.gps_vehicle_name || format(new Date(upload.upload_month), 'MMMM yyyy')}
                      </p>
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
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(upload.upload_month), 'MMMM yyyy')} • {upload.file_name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className="font-semibold">{Number(upload.kilometers).toLocaleString()} km</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(upload)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}