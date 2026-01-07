import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, AlertCircle, Loader2, ZoomIn, FileText, FileSpreadsheet, Plus, Trash2, Split } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

export interface ExpenseItem {
  id: string;
  category_suggestion: string;
  description: string;
  subtotal?: number;
  tax_amount?: number;
  amount: number;
}

export interface ScannedMultiExpenseData {
  vendor_name?: string;
  vendor_address?: string;
  date?: string;
  subtotal?: number;
  tax_amount?: number;
  total?: number;
  expense_items: ExpenseItem[];
}

interface Category {
  id: string;
  name: string;
  type: string;
}

interface MultiExpenseVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scannedData: ScannedMultiExpenseData | null;
  isScanning: boolean;
  imageFile: File | null;
  categories: Category[];
  onConfirm: (data: ScannedMultiExpenseData) => void;
  onCancel: () => void;
}

export function MultiExpenseVerificationDialog({
  open,
  onOpenChange,
  scannedData,
  isScanning,
  imageFile,
  categories,
  onConfirm,
  onCancel,
}: MultiExpenseVerificationDialogProps) {
  const [editedData, setEditedData] = useState<ScannedMultiExpenseData>({
    expense_items: [],
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showFullImage, setShowFullImage] = useState(false);

  useEffect(() => {
    if (scannedData) {
      // Add unique IDs to expense items
      const itemsWithIds = (scannedData.expense_items || []).map((item, index) => ({
        ...item,
        id: `item-${Date.now()}-${index}`,
      }));
      setEditedData({
        ...scannedData,
        expense_items: itemsWithIds,
      });
    }
  }, [scannedData]);

  useEffect(() => {
    if (imageFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(imageFile);
    } else {
      setImagePreview(null);
    }
  }, [imageFile]);

  const matchCategoryByName = (suggestion: string): string => {
    if (!suggestion) return '';
    const lower = suggestion.toLowerCase();
    const matched = categories.find(c => 
      c.name.toLowerCase().includes(lower) || 
      lower.includes(c.name.toLowerCase()) ||
      c.type.toLowerCase() === lower
    );
    return matched?.id || '';
  };

  const updateExpenseItem = (id: string, updates: Partial<ExpenseItem>) => {
    setEditedData(prev => ({
      ...prev,
      expense_items: prev.expense_items.map(item =>
        item.id === id ? { ...item, ...updates } : item
      ),
    }));
  };

  const removeExpenseItem = (id: string) => {
    setEditedData(prev => ({
      ...prev,
      expense_items: prev.expense_items.filter(item => item.id !== id),
    }));
  };

  const addExpenseItem = () => {
    const newItem: ExpenseItem = {
      id: `item-${Date.now()}`,
      category_suggestion: '',
      description: '',
      amount: 0,
    };
    setEditedData(prev => ({
      ...prev,
      expense_items: [...prev.expense_items, newItem],
    }));
  };

  const getMissingFields = () => {
    const missing: string[] = [];
    if (!editedData.vendor_name) missing.push('Vendor Name');
    if (!editedData.date) missing.push('Date');
    if (editedData.expense_items.length === 0) missing.push('At least one expense item');
    if (editedData.expense_items.some(item => !item.amount || item.amount <= 0)) {
      missing.push('Valid amounts for all items');
    }
    return missing;
  };

  const missingFields = getMissingFields();
  const totalItemsAmount = editedData.expense_items.reduce((sum, item) => sum + (item.amount || 0), 0);

  const handleConfirm = () => {
    onConfirm(editedData);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-hidden grid grid-rows-[auto_minmax(0,1fr)_auto] min-h-0">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isScanning ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Scanning Invoice...
              </>
            ) : (
              <>
                <Split className="h-5 w-5 text-primary" />
                Review Expense Items
              </>
            )}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isScanning
              ? 'Analyzing invoice for multiple expense types...'
              : 'This invoice contains multiple expense types. Review and adjust the allocation below.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isScanning ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              <p className="text-muted-foreground">Detecting expense categories...</p>
              {imagePreview ? (
                <div className="mt-4">
                  <img
                    src={imagePreview}
                    alt="Document being scanned"
                    className="max-h-32 mx-auto rounded-lg border opacity-50"
                  />
                </div>
              ) : imageFile && (
                <div className="mt-4 flex flex-col items-center">
                  {imageFile.name.endsWith('.csv') ? (
                    <FileSpreadsheet className="h-12 w-12 text-muted-foreground opacity-50" />
                  ) : (
                    <FileText className="h-12 w-12 text-muted-foreground opacity-50" />
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{imageFile.name}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="relative min-h-0">
            <ScrollArea className="h-full min-h-0 pr-4">
              <div className="space-y-4 py-4">
              {/* File Preview */}
              {imagePreview && (
                <div className="relative">
                  <div 
                    className="relative cursor-pointer group"
                    onClick={() => setShowFullImage(!showFullImage)}
                  >
                    <img
                      src={imagePreview}
                      alt="Receipt preview"
                      className={`rounded-lg border transition-all ${
                        showFullImage ? 'max-h-60 w-full object-contain' : 'max-h-20 w-auto'
                      }`}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                      <ZoomIn className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </div>
              )}

              {missingFields.length > 0 && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Missing Information
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      {missingFields.join(', ')}
                    </p>
                  </div>
                </div>
              )}

              {/* Common Invoice Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="verify-vendor">Vendor Name</Label>
                  <Input
                    id="verify-vendor"
                    value={editedData.vendor_name || ''}
                    onChange={(e) =>
                      setEditedData({ ...editedData, vendor_name: e.target.value })
                    }
                    placeholder="Enter vendor name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="verify-date">Invoice Date</Label>
                  <Input
                    id="verify-date"
                    type="date"
                    value={editedData.date || ''}
                    onChange={(e) =>
                      setEditedData({ ...editedData, date: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted p-2 rounded">
                <span>Invoice Total: ${editedData.total?.toFixed(2) || '0.00'}</span>
                <span>Items Total: ${totalItemsAmount.toFixed(2)}</span>
                {editedData.total && Math.abs(totalItemsAmount - editedData.total) > 0.01 && (
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    Difference: ${(editedData.total - totalItemsAmount).toFixed(2)}
                  </Badge>
                )}
              </div>

              <Separator />

              {/* Expense Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Expense Items</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addExpenseItem}
                    className="gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Add Item
                  </Button>
                </div>

                {editedData.expense_items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                    <p>No expense items detected.</p>
                    <p className="text-sm">Click "Add Item" to manually add expenses.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {editedData.expense_items.map((item, index) => (
                      <div
                        key={item.id}
                        className="p-3 border rounded-lg bg-card space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary">Item {index + 1}</Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeExpenseItem(item.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Category</Label>
                            <Select
                              value={matchCategoryByName(item.category_suggestion) || item.category_suggestion}
                              onValueChange={(value) =>
                                updateExpenseItem(item.id, { category_suggestion: value })
                              }
                            >
                              <SelectTrigger className="bg-background">
                                <SelectValue placeholder={item.category_suggestion || "Select category"} />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((cat) => (
                                  <SelectItem key={cat.id} value={cat.id}>
                                    {cat.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {item.category_suggestion && !matchCategoryByName(item.category_suggestion) && (
                              <p className="text-xs text-muted-foreground">
                                Suggested: {item.category_suggestion}
                              </p>
                            )}
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Amount ($)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.amount || ''}
                              onChange={(e) =>
                                updateExpenseItem(item.id, {
                                  amount: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="font-semibold"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Description</Label>
                          <Textarea
                            value={item.description || ''}
                            onChange={(e) =>
                              updateExpenseItem(item.id, { description: e.target.value })
                            }
                            placeholder="Service/items description"
                            rows={2}
                            className="text-sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {editedData.vendor_address && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Vendor Address (detected)</Label>
                  <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                    {editedData.vendor_address}
                  </p>
                </div>
              )}
              </div>
            </ScrollArea>
            {/* Scroll hint gradient */}
            <div className="absolute bottom-0 left-0 right-4 h-12 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none flex items-end justify-center pb-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <svg className="h-3 w-3 animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
                Scroll for more
              </span>
            </div>
          </div>
        )}

        <AlertDialogFooter className="mt-4">
          <Button variant="outline" onClick={onCancel} disabled={isScanning}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isScanning || editedData.expense_items.length === 0}
          >
            {editedData.expense_items.length > 1 
              ? `Create ${editedData.expense_items.length} Expenses`
              : 'Confirm & Apply'
            }
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
