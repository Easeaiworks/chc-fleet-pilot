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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, AlertCircle, FileSpreadsheet, Pencil, Trash2 } from 'lucide-react';

interface Vehicle {
  id: string;
  plate: string;
  vin: string;
  make: string | null;
  model: string | null;
}

interface Branch {
  id: string;
  name: string;
  location: string | null;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

interface ParsedExpenseRecord {
  date: string;
  vehicle: string;
  branch: string;
  category: string;
  amount: number;
  description: string;
  odometer: number | null;
  lineNumber: number;
}

export interface PreviewExpenseEntry extends ParsedExpenseRecord {
  matchedVehicle: Vehicle | null;
  matchedBranch: Branch | null;
  matchedCategory: Category | null;
}

interface ExpensePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: ParsedExpenseRecord[];
  vehicles: Vehicle[];
  branches: Branch[];
  categories: Category[];
  fileName: string;
  onConfirm: (editedEntries: PreviewExpenseEntry[]) => void;
  onCancel: () => void;
}

export function ExpensePreviewDialog({
  open,
  onOpenChange,
  records,
  vehicles,
  branches,
  categories,
  fileName,
  onConfirm,
  onCancel,
}: ExpensePreviewDialogProps) {
  const [previewEntries, setPreviewEntries] = useState<PreviewExpenseEntry[]>([]);
  const [editingField, setEditingField] = useState<{ index: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  const matchVehicle = (vehicleStr: string): Vehicle | null => {
    if (!vehicleStr) return null;
    const lower = vehicleStr.toLowerCase();
    return vehicles.find(v =>
      v.vin?.toLowerCase() === lower ||
      v.plate?.toLowerCase() === lower ||
      v.vin?.toLowerCase().includes(lower) ||
      v.plate?.toLowerCase().includes(lower)
    ) || null;
  };

  const matchBranch = (branchStr: string): Branch | null => {
    if (!branchStr) return null;
    const lower = branchStr.toLowerCase();
    return branches.find(b =>
      b.name?.toLowerCase() === lower ||
      b.location?.toLowerCase().includes(lower)
    ) || null;
  };

  const matchCategory = (categoryStr: string): Category | null => {
    if (!categoryStr) return null;
    const lower = categoryStr.toLowerCase();
    return categories.find(c =>
      c.name?.toLowerCase() === lower ||
      c.name?.toLowerCase().includes(lower)
    ) || null;
  };

  useEffect(() => {
    if (open && records.length > 0) {
      const processed = records.map((record) => {
        const matchedVehicle = matchVehicle(record.vehicle);
        const matchedBranch = matchBranch(record.branch);
        const matchedCategory = matchCategory(record.category);
        
        return {
          ...record,
          matchedVehicle,
          matchedBranch: matchedBranch || (matchedVehicle ? branches.find(b => b.id === (vehicles.find(v => v.id === matchedVehicle.id) as any)?.branch_id) || null : null),
          matchedCategory,
        };
      });
      setPreviewEntries(processed);
      setEditingField(null);
    }
  }, [open, records, vehicles, branches, categories]);

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

  const handleBranchChange = (index: number, branchId: string) => {
    setPreviewEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry;
        if (branchId === 'none') {
          return { ...entry, matchedBranch: null };
        }
        const branch = branches.find((b) => b.id === branchId) || null;
        return { ...entry, matchedBranch: branch };
      })
    );
  };

  const handleCategoryChange = (index: number, categoryId: string) => {
    setPreviewEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry;
        if (categoryId === 'none') {
          return { ...entry, matchedCategory: null };
        }
        const category = categories.find((c) => c.id === categoryId) || null;
        return { ...entry, matchedCategory: category };
      })
    );
  };

  const handleFieldEdit = (index: number, field: string) => {
    const entry = previewEntries[index];
    let value = '';
    if (field === 'amount') value = entry.amount.toString();
    else if (field === 'date') value = entry.date;
    else if (field === 'description') value = entry.description;
    else if (field === 'odometer') value = entry.odometer?.toString() || '';
    
    setEditingField({ index, field });
    setEditValue(value);
  };

  const handleFieldSave = () => {
    if (!editingField) return;
    const { index, field } = editingField;

    setPreviewEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry;
        if (field === 'amount') {
          const parsed = parseFloat(editValue);
          return { ...entry, amount: isNaN(parsed) ? entry.amount : parsed };
        }
        if (field === 'date') {
          return { ...entry, date: editValue || entry.date };
        }
        if (field === 'description') {
          return { ...entry, description: editValue };
        }
        if (field === 'odometer') {
          const parsed = parseInt(editValue);
          return { ...entry, odometer: isNaN(parsed) ? null : parsed };
        }
        return entry;
      })
    );
    setEditingField(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFieldSave();
    } else if (e.key === 'Escape') {
      setEditingField(null);
      setEditValue('');
    }
  };

  const handleRemoveEntry = (index: number) => {
    setPreviewEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const matchedVehicleCount = previewEntries.filter((e) => e.matchedVehicle).length;
  const unmatchedVehicleCount = previewEntries.filter((e) => !e.matchedVehicle).length;
  const totalAmount = previewEntries.reduce((sum, e) => sum + e.amount, 0);

  const handleConfirm = () => {
    onConfirm(previewEntries);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Preview Expense Import
          </DialogTitle>
          <DialogDescription>
            Review and edit the parsed expenses before importing. Click values to edit, change vehicle/category assignments, or remove entries.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-muted/50 rounded-lg text-sm">
          <div>
            <p className="text-muted-foreground">Total Records</p>
            <p className="text-lg font-bold">{previewEntries.length}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Total Amount</p>
            <p className="text-lg font-bold">${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Matched Vehicles</p>
            <p className="text-lg font-bold text-green-600">{matchedVehicleCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Unmatched</p>
            <p className="text-lg font-bold text-amber-600">{unmatchedVehicleCount}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="truncate">{fileName}</span>
        </div>

        <ScrollArea className="max-h-[50vh] border rounded-lg overflow-hidden">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-[1fr_140px_140px_140px_100px_140px_40px] gap-2 p-2 bg-muted text-xs font-medium sticky top-0 border-b">
              <div>Date / Description</div>
              <div>Vehicle</div>
              <div>Category</div>
              <div>Branch</div>
              <div className="text-right">Amount</div>
              <div className="text-right">Odometer</div>
              <div></div>
            </div>
            <div className="divide-y">
              {previewEntries.map((entry, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_140px_140px_140px_100px_140px_40px] gap-2 p-2 hover:bg-muted/30 items-center text-sm"
                >
                  <div className="min-w-0">
                    {editingField?.index === index && editingField?.field === 'date' ? (
                      <Input
                        type="date"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleFieldSave}
                        onKeyDown={handleKeyDown}
                        className="h-7 text-xs"
                        autoFocus
                      />
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-medium text-xs justify-start"
                        onClick={() => handleFieldEdit(index, 'date')}
                      >
                        {entry.date}
                        <Pencil className="h-3 w-3 ml-1 opacity-50" />
                      </Button>
                    )}
                    {editingField?.index === index && editingField?.field === 'description' ? (
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleFieldSave}
                        onKeyDown={handleKeyDown}
                        className="h-7 text-xs mt-1"
                        autoFocus
                      />
                    ) : (
                      <p
                        className="text-muted-foreground text-xs truncate cursor-pointer hover:underline"
                        onClick={() => handleFieldEdit(index, 'description')}
                        title={entry.description || 'Click to add description'}
                      >
                        {entry.description || <span className="italic">No description</span>}
                      </p>
                    )}
                  </div>

                  <Select
                    value={entry.matchedVehicle?.id || 'none'}
                    onValueChange={(value) => handleVehicleChange(index, value)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue>
                        {entry.matchedVehicle ? (
                          <span className="flex items-center gap-1">
                            <Check className="h-3 w-3 text-green-600 shrink-0" />
                            <span className="truncate">{entry.matchedVehicle.plate}</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-600">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            <span className="truncate">{entry.vehicle || 'Unmatched'}</span>
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

                  <Select
                    value={entry.matchedCategory?.id || 'none'}
                    onValueChange={(value) => handleCategoryChange(index, value)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue>
                        {entry.matchedCategory ? (
                          <span className="truncate">{entry.matchedCategory.name}</span>
                        ) : (
                          <span className="text-muted-foreground truncate">{entry.category || 'Select'}</span>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-background border z-50">
                      <SelectItem value="none" className="text-muted-foreground">
                        None
                      </SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={entry.matchedBranch?.id || 'none'}
                    onValueChange={(value) => handleBranchChange(index, value)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue>
                        {entry.matchedBranch ? (
                          <span className="truncate">{entry.matchedBranch.name}</span>
                        ) : (
                          <span className="text-muted-foreground truncate">Select</span>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-background border z-50">
                      <SelectItem value="none" className="text-muted-foreground">
                        None
                      </SelectItem>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {editingField?.index === index && editingField?.field === 'amount' ? (
                    <Input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={handleFieldSave}
                      onKeyDown={handleKeyDown}
                      className="h-8 text-right text-xs"
                      min="0"
                      step="0.01"
                      autoFocus
                    />
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 justify-end font-semibold tabular-nums text-xs px-2"
                      onClick={() => handleFieldEdit(index, 'amount')}
                    >
                      ${entry.amount.toFixed(2)}
                      <Pencil className="h-3 w-3 ml-1 opacity-50" />
                    </Button>
                  )}

                  {editingField?.index === index && editingField?.field === 'odometer' ? (
                    <Input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={handleFieldSave}
                      onKeyDown={handleKeyDown}
                      className="h-8 text-right text-xs"
                      min="0"
                      autoFocus
                    />
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 justify-end tabular-nums text-xs px-2"
                      onClick={() => handleFieldEdit(index, 'odometer')}
                    >
                      {entry.odometer ? `${entry.odometer.toLocaleString()} km` : '-'}
                      <Pencil className="h-3 w-3 ml-1 opacity-50" />
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveEntry(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>

        {previewEntries.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No entries to import
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={previewEntries.length === 0 || unmatchedVehicleCount === previewEntries.length}
          >
            Import {previewEntries.filter(e => e.matchedVehicle).length} Expenses
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}