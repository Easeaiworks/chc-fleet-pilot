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
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, AlertCircle, Loader2, ZoomIn, FileText, FileSpreadsheet } from 'lucide-react';
export interface ScannedReceiptData {
  vendor_name?: string;
  vendor_address?: string;
  subtotal?: number;
  tax_amount?: number;
  total?: number;
  date?: string;
  description?: string;
  raw_text?: string;
}

interface ReceiptVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scannedData: ScannedReceiptData | null;
  isScanning: boolean;
  imageFile: File | null;
  onConfirm: (data: ScannedReceiptData) => void;
  onCancel: () => void;
}

export function ReceiptVerificationDialog({
  open,
  onOpenChange,
  scannedData,
  isScanning,
  imageFile,
  onConfirm,
  onCancel,
}: ReceiptVerificationDialogProps) {
  const [editedData, setEditedData] = useState<ScannedReceiptData>({});
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showFullImage, setShowFullImage] = useState(false);

  useEffect(() => {
    if (scannedData) {
      setEditedData(scannedData);
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

  useEffect(() => {
    if (scannedData) {
      setEditedData(scannedData);
    }
  }, [scannedData]);

  const getMissingFields = () => {
    const missing: string[] = [];
    if (!editedData.vendor_name) missing.push('Vendor Name');
    if (!editedData.total && editedData.total !== 0) missing.push('Total Amount');
    if (!editedData.date) missing.push('Date');
    return missing;
  };

  const missingFields = getMissingFields();

  const handleConfirm = () => {
    onConfirm(editedData);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg max-h-[90vh] overflow-hidden grid grid-rows-[auto_minmax(0,1fr)_auto] min-h-0">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isScanning ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Scanning Receipt...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Verify Scanned Data
              </>
            )}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isScanning
              ? 'Please wait while we extract information from your receipt...'
              : 'Please verify the extracted information and fill in any missing fields.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isScanning ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              <p className="text-muted-foreground">Analyzing document...</p>
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
            <ScrollArea className="h-full min-h-0 max-h-[60vh] pr-4">
              <div className="space-y-4 py-4">
            {/* File Preview */}
            {imagePreview ? (
              <div className="relative">
                <div 
                  className="relative cursor-pointer group"
                  onClick={() => setShowFullImage(!showFullImage)}
                >
                  <img
                    src={imagePreview}
                    alt="Receipt preview"
                    className={`rounded-lg border transition-all ${
                      showFullImage ? 'max-h-96 w-full object-contain' : 'max-h-24 w-auto'
                    }`}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                    <ZoomIn className="h-6 w-6 text-white" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {showFullImage ? 'Click to minimize' : 'Click to expand preview'}
                </p>
              </div>
            ) : imageFile && (
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                {imageFile.name.endsWith('.csv') ? (
                  <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                ) : imageFile.type === 'application/pdf' ? (
                  <FileText className="h-8 w-8 text-red-500" />
                ) : (
                  <FileText className="h-8 w-8 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium">{imageFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(imageFile.size / 1024).toFixed(1)} KB
                  </p>
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
                    Please fill in: {missingFields.join(', ')}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="verify-vendor">
                Vendor Name
                {!editedData.vendor_name && (
                  <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300">
                    Required
                  </Badge>
                )}
              </Label>
              <Input
                id="verify-vendor"
                value={editedData.vendor_name || ''}
                onChange={(e) =>
                  setEditedData({ ...editedData, vendor_name: e.target.value })
                }
                placeholder="Enter vendor name"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="verify-subtotal">Subtotal ($)</Label>
                <Input
                  id="verify-subtotal"
                  type="number"
                  step="0.01"
                  value={editedData.subtotal || ''}
                  onChange={(e) =>
                    setEditedData({
                      ...editedData,
                      subtotal: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="verify-tax">Tax ($)</Label>
                <Input
                  id="verify-tax"
                  type="number"
                  step="0.01"
                  value={editedData.tax_amount || ''}
                  onChange={(e) =>
                    setEditedData({
                      ...editedData,
                      tax_amount: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="verify-total">
                  Total ($)
                  {!editedData.total && editedData.total !== 0 && (
                    <Badge variant="outline" className="ml-1 text-amber-600 border-amber-300 text-xs">
                      Req
                    </Badge>
                  )}
                </Label>
                <Input
                  id="verify-total"
                  type="number"
                  step="0.01"
                  value={editedData.total || ''}
                  onChange={(e) =>
                    setEditedData({
                      ...editedData,
                      total: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  placeholder="0.00"
                  className="font-semibold"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verify-date">
                Date
                {!editedData.date && (
                  <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300">
                    Required
                  </Badge>
                )}
              </Label>
              <Input
                id="verify-date"
                type="date"
                value={editedData.date || ''}
                onChange={(e) =>
                  setEditedData({ ...editedData, date: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="verify-description">Description</Label>
              <Textarea
                id="verify-description"
                value={editedData.description || ''}
                onChange={(e) =>
                  setEditedData({ ...editedData, description: e.target.value })
                }
                placeholder="Items purchased, services rendered..."
                rows={2}
              />
            </div>

            {editedData.vendor_address && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Vendor Address (detected)</Label>
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
          <Button onClick={handleConfirm} disabled={isScanning}>
            Confirm & Apply
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
