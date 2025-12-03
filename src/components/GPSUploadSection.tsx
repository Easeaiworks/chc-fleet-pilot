import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, Trash2, Navigation } from 'lucide-react';
import { format, parse } from 'date-fns';

interface GPSUpload {
  id: string;
  file_name: string;
  upload_month: string;
  kilometers: number;
  created_at: string;
  notes: string | null;
}

interface GPSUploadSectionProps {
  vehicleId: string;
  onKilometersUpdated?: () => void;
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
    const { data, error } = await supabase
      .from('gps_uploads')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('upload_month', { ascending: false });

    if (error) {
      console.error('Error fetching GPS uploads:', error);
    } else {
      setUploads(data || []);
    }
    setLoading(false);
  };

  const parseGPSFile = async (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());
          
          if (lines.length < 2) {
            reject(new Error('File appears to be empty or invalid'));
            return;
          }

          const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
          
          // Look for kilometer/distance column
          const kmColIndex = headers.findIndex(h => 
            h.includes('km') || 
            h.includes('kilometer') || 
            h.includes('kilometre') || 
            h.includes('distance') ||
            h.includes('mileage') ||
            h.includes('odometer') ||
            h.includes('total')
          );

          let totalKm = 0;

          if (kmColIndex >= 0) {
            // Sum all kilometers from the column
            for (let i = 1; i < lines.length; i++) {
              const values = lines[i].split(',');
              if (values[kmColIndex]) {
                const km = parseFloat(values[kmColIndex].replace(/[^0-9.-]/g, ''));
                if (!isNaN(km) && km > 0) {
                  totalKm += km;
                }
              }
            }
          } else {
            // Try to find any numeric value that could be kilometers
            // Look at the last row for a total
            const lastLine = lines[lines.length - 1].split(',');
            for (const val of lastLine) {
              const num = parseFloat(val.replace(/[^0-9.-]/g, ''));
              if (!isNaN(num) && num > 100) { // Assume km values would be > 100
                totalKm = num;
                break;
              }
            }
          }

          if (totalKm === 0) {
            reject(new Error('Could not find kilometer data in the file. Please ensure the file has a column with km/distance/mileage data.'));
            return;
          }

          resolve(totalKm);
        } catch (error) {
          reject(new Error('Failed to parse file'));
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = ['.csv', '.xls', '.xlsx'];
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
      // Parse the file to extract kilometers
      let kilometers = 0;
      
      if (fileExtension === '.csv') {
        kilometers = await parseGPSFile(file);
      } else {
        // For Excel files, we'll store them and let user enter km manually
        toast({
          title: 'Excel File Detected',
          description: 'Please enter the total kilometers manually after upload',
        });
      }

      // Upload file to storage
      const filePath = `gps/${vehicleId}/${selectedMonth}-${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('vehicle-documents')
        .upload(filePath, file);

      if (uploadError) {
        throw new Error('Failed to upload file');
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Create database record
      const uploadMonth = parse(selectedMonth, 'yyyy-MM', new Date());
      const { error: dbError } = await supabase
        .from('gps_uploads')
        .insert({
          vehicle_id: vehicleId,
          file_name: file.name,
          file_path: filePath,
          upload_month: format(uploadMonth, 'yyyy-MM-dd'),
          kilometers: kilometers,
          uploaded_by: user?.id,
        });

      if (dbError) {
        throw new Error('Failed to save record');
      }

      // Update vehicle odometer if we have kilometers
      if (kilometers > 0) {
        const { data: vehicle } = await supabase
          .from('vehicles')
          .select('odometer_km')
          .eq('id', vehicleId)
          .single();

        if (vehicle) {
          await supabase
            .from('vehicles')
            .update({ odometer_km: (vehicle.odometer_km || 0) + kilometers })
            .eq('id', vehicleId);
        }
      }

      toast({
        title: 'GPS Data Uploaded',
        description: `Added ${kilometers.toLocaleString()} km for ${format(uploadMonth, 'MMMM yyyy')}`,
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
    if (!confirm(`Delete GPS data for ${format(new Date(upload.upload_month), 'MMMM yyyy')}? This will subtract ${upload.kilometers.toLocaleString()} km from the vehicle's odometer.`)) {
      return;
    }

    try {
      // Delete from database
      const { error: dbError } = await supabase
        .from('gps_uploads')
        .delete()
        .eq('id', upload.id);

      if (dbError) throw dbError;

      // Subtract kilometers from vehicle
      const { data: vehicle } = await supabase
        .from('vehicles')
        .select('odometer_km')
        .eq('id', vehicleId)
        .single();

      if (vehicle) {
        await supabase
          .from('vehicles')
          .update({ odometer_km: Math.max(0, (vehicle.odometer_km || 0) - upload.kilometers) })
          .eq('id', vehicleId);
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

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Navigation className="h-5 w-5" />
          GPS Mileage Tracker
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Total GPS Kilometers</p>
            <p className="text-2xl font-bold">{totalGPSKilometers.toLocaleString()} km</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Files Uploaded</p>
            <p className="text-2xl font-bold">{uploads.length}</p>
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
                accept=".csv,.xls,.xlsx"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </Label>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading uploads...</p>
        ) : uploads.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <FileSpreadsheet className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No GPS files uploaded yet</p>
            <p className="text-xs">Upload a CSV or Excel file with mileage data</p>
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
                    <p className="font-medium">
                      {format(new Date(upload.upload_month), 'MMMM yyyy')}
                    </p>
                    <p className="text-xs text-muted-foreground">{upload.file_name}</p>
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