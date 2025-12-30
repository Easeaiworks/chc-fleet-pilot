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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Check, AlertCircle, FileSpreadsheet, Calendar, Pencil, AlertTriangle, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';

interface ParseWarning {
  rowNumber: number;
  vehicleName: string;
  rawValue: string;
  issue: string;
}

interface ParsedVehicleEntry {
  vehicleName: string;
  kilometers: number;
  rowNumber?: number;
  hadParseIssue?: boolean;
  originalValue?: string;
}

interface Vehicle {
  id: string;
  plate: string;
  vin: string;
  make: string | null;
  model: string | null;
}

export interface PreviewEntry extends ParsedVehicleEntry {
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
  warnings?: ParseWarning[];
  onConfirm: (editedEntries: PreviewEntry[]) => void;
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
  warnings = [],
  onConfirm,
  onCancel,
  matchVehicle,
}: GPSPreviewDialogProps) {
  const [previewEntries, setPreviewEntries] = useState<PreviewEntry[]>([]);
  const [editingKmIndex, setEditingKmIndex] = useState<number | null>(null);
  const [editKmValue, setEditKmValue] = useState('');
  const [warningsOpen, setWarningsOpen] = useState(warnings.length > 0);

  useEffect(() => {
    if (open && entries.length > 0) {
      const processed = entries.map((entry) => ({
        ...entry,
        matchedVehicle: matchVehicle(entry.vehicleName, vehicles),
      }));
      setPreviewEntries(processed);
      setEditingKmIndex(null);
      setWarningsOpen(warnings.length > 0);
    }
  }, [open, entries, vehicles, matchVehicle, warnings.length]);

  const handleVehicleChange = (index: number, vehicleId: string) => {
    setPreviewEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry;
        if (vehicleId === 'none') {
          return { ...entry, matchedVehicle: null };
        }
        const vehicle = vehicles.find((v) => v.id === vehicleId) || null;
        return { ...entry, matchedVehicle: vehicle };
      })
    );
  };

  const handleKmEdit = (index: number) => {
    setEditingKmIndex(index);
    setEditKmValue(previewEntries[index].kilometers.toString());
  };

  const handleKmSave = (index: number) => {
    const parsed = parseFloat(editKmValue);
    if (!isNaN(parsed) && parsed >= 0) {
      setPreviewEntries((prev) =>
        prev.map((entry, i) =>
          i === index ? { ...entry, kilometers: parsed } : entry
        )
      );
    }
    setEditingKmIndex(null);
    setEditKmValue('');
  };

  const handleKmKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      handleKmSave(index);
    } else if (e.key === 'Escape') {
      setEditingKmIndex(null);
      setEditKmValue('');
    }
  };

  const matchedEntries = previewEntries.filter((e) => e.matchedVehicle);
  const unmatchedEntries = previewEntries.filter((e) => !e.matchedVehicle);
  const matchedCount = matchedEntries.length;
  const unmatchedCount = unmatchedEntries.length;
  const matchedKm = matchedEntries.reduce((sum, e) => sum + e.kilometers, 0);
  const unmatchedKm = unmatchedEntries.reduce((sum, e) => sum + e.kilometers, 0);
  const totalKm = matchedKm + unmatchedKm;

  const dateRangeText =
    dateFrom && dateTo
      ? `${format(dateFrom, 'MMM d, yyyy')} - ${format(dateTo, 'MMM d, yyyy')}`
      : dateFrom
      ? format(dateFrom, 'MMMM yyyy')
      : 'Unknown date range';

  const handleConfirm = () => {
    onConfirm(previewEntries);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Preview GPS Data
          </DialogTitle>
          <DialogDescription>
            Review and edit the parsed data before uploading. Click kilometers to edit, or change vehicle assignments.
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

        {warnings.length > 0 && (
          <Collapsible open={warningsOpen} onOpenChange={setWarningsOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between p-3 h-auto bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-950/50"
              >
                <span className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">{warnings.length} row{warnings.length > 1 ? 's' : ''} with parsing issues</span>
                </span>
                <ChevronDown className={`h-4 w-4 text-amber-600 transition-transform ${warningsOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden">
                <div className="bg-amber-50 dark:bg-amber-950/30 px-3 py-2 border-b border-amber-200 dark:border-amber-800">
                  <div className="grid grid-cols-12 gap-2 text-xs font-medium text-amber-800 dark:text-amber-300">
                    <div className="col-span-1">Row</div>
                    <div className="col-span-3">Vehicle</div>
                    <div className="col-span-2">Raw Value</div>
                    <div className="col-span-6">Issue</div>
                  </div>
                </div>
                <ScrollArea className="max-h-32">
                  <div className="divide-y divide-amber-100 dark:divide-amber-900">
                    {warnings.map((warning, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 text-xs bg-white dark:bg-background">
                        <div className="col-span-1 font-mono text-muted-foreground">{warning.rowNumber}</div>
                        <div className="col-span-3 truncate font-medium">{warning.vehicleName}</div>
                        <div className="col-span-2 font-mono text-muted-foreground truncate">
                          {warning.rawValue || '(empty)'}
                        </div>
                        <div className="col-span-6 text-amber-700 dark:text-amber-400">{warning.issue}</div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        <ScrollArea className="flex-1 min-h-0 border rounded-lg">
          <div className="divide-y">
            {previewEntries.map((entry, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 p-3 hover:bg-muted/30 ${entry.hadParseIssue ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate text-sm">{entry.vehicleName}</p>
                </div>

                <Select
                  value={entry.matchedVehicle?.id || 'none'}
                  onValueChange={(value) => handleVehicleChange(index, value)}
                >
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <SelectValue>
                      {entry.matchedVehicle ? (
                        <span className="flex items-center gap-1">
                          <Check className="h-3 w-3 text-green-600" />
                          {entry.matchedVehicle.plate}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-600">
                          <AlertCircle className="h-3 w-3" />
                          Unmatched
                        </span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-background border z-50">
                    <SelectItem value="none" className="text-amber-600">
                      <span className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Unmatched
                      </span>
                    </SelectItem>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        <span className="flex items-center gap-1">
                          <Check className="h-3 w-3 text-green-600" />
                          {vehicle.plate} - {vehicle.make} {vehicle.model}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {editingKmIndex === index ? (
                  <Input
                    type="number"
                    value={editKmValue}
                    onChange={(e) => setEditKmValue(e.target.value)}
                    onBlur={() => handleKmSave(index)}
                    onKeyDown={(e) => handleKmKeyDown(e, index)}
                    className="w-24 h-8 text-right text-sm"
                    min="0"
                    step="0.01"
                    autoFocus
                  />
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-28 justify-end font-semibold tabular-nums text-sm h-8 px-2"
                    onClick={() => handleKmEdit(index)}
                  >
                    {Number(entry.kilometers).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} km
                    <Pencil className="h-3 w-3 ml-1 opacity-50" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="border rounded-lg bg-muted/30 p-3">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-green-600" />
                Matched
              </span>
              <span className="font-semibold tabular-nums text-green-600">
                {matchedKm.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} km
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                Unmatched
              </span>
              <span className="font-semibold tabular-nums text-amber-600">
                {unmatchedKm.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} km
              </span>
            </div>
            <div className="flex items-center justify-between border-l pl-4">
              <span className="text-muted-foreground font-medium">Total</span>
              <span className="font-bold tabular-nums">
                {totalKm.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} km
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Confirm Upload ({previewEntries.length} vehicles)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
