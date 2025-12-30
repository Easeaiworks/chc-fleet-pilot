import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, AlertCircle, FileSpreadsheet, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface ParsedVehicleEntry {
  vehicleName: string;
  kilometers: number;
}

interface Vehicle {
  id: string;
  plate: string;
  vin: string;
  make: string | null;
  model: string | null;
}

interface PreviewEntry extends ParsedVehicleEntry {
  matchedVehicle: Vehicle | null;
}

interface GPSPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: ParsedVehicleEntry[];
  vehicles: Vehicle[];
  dateFrom: Date | null;
  dateTo: Date | null;
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
  matchVehicle: (gpsName: string, vehicles: Vehicle[]) => Vehicle | null;
}

export function GPSPreviewDialog({
  open,
  onOpenChange,
  entries,
  vehicles,
  dateFrom,
  dateTo,
  fileName,
  onConfirm,
  onCancel,
  matchVehicle,
}: GPSPreviewDialogProps) {
  const [previewEntries, setPreviewEntries] = useState<PreviewEntry[]>([]);

  useEffect(() => {
    if (open && entries.length > 0) {
      const processed = entries.map((entry) => ({
        ...entry,
        matchedVehicle: matchVehicle(entry.vehicleName, vehicles),
      }));
      setPreviewEntries(processed);
    }
  }, [open, entries, vehicles, matchVehicle]);

  const matchedCount = previewEntries.filter((e) => e.matchedVehicle).length;
  const unmatchedCount = previewEntries.filter((e) => !e.matchedVehicle).length;
  const totalKm = previewEntries.reduce((sum, e) => sum + e.kilometers, 0);

  const dateRangeText =
    dateFrom && dateTo
      ? `${format(dateFrom, 'MMM d, yyyy')} - ${format(dateTo, 'MMM d, yyyy')}`
      : dateFrom
      ? format(dateFrom, 'MMMM yyyy')
      : 'Unknown date range';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Preview GPS Data
          </DialogTitle>
          <DialogDescription>
            Review the parsed data before uploading. Verify vehicle matches and kilometers.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-muted/50 rounded-lg text-sm">
          <div>
            <p className="text-muted-foreground">Total Vehicles</p>
            <p className="text-lg font-bold">{previewEntries.length}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Total Kilometers</p>
            <p className="text-lg font-bold">{totalKm.toLocaleString()} km</p>
          </div>
          <div>
            <p className="text-muted-foreground">Matched</p>
            <p className="text-lg font-bold text-green-600">{matchedCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Unmatched</p>
            <p className="text-lg font-bold text-amber-600">{unmatchedCount}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{dateRangeText}</span>
          <span className="mx-2">•</span>
          <span className="truncate">{fileName}</span>
        </div>

        <ScrollArea className="flex-1 min-h-0 border rounded-lg">
          <div className="divide-y">
            {previewEntries.map((entry, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 hover:bg-muted/30"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{entry.vehicleName}</p>
                      {entry.matchedVehicle ? (
                        <Badge variant="outline" className="text-green-600 border-green-600 shrink-0">
                          <Check className="h-3 w-3 mr-1" />
                          {entry.matchedVehicle.plate}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-600 shrink-0">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Unmatched
                        </Badge>
                      )}
                    </div>
                    {entry.matchedVehicle && (
                      <p className="text-xs text-muted-foreground">
                        {entry.matchedVehicle.make} {entry.matchedVehicle.model}
                      </p>
                    )}
                  </div>
                </div>
                <p className="font-semibold tabular-nums shrink-0 ml-3">
                  {entry.kilometers.toLocaleString()} km
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>
            Confirm Upload ({previewEntries.length} vehicles)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
