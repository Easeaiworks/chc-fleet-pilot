import { useState } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { parseCSVFile } from "@/utils/csvParser";
import { parsePDFWorkOrder } from "@/utils/pdfParser";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { ExpensePreviewDialog, PreviewExpenseEntry } from './ExpensePreviewDialog';

interface ImportPreview {
  fileName: string;
  fileType: string;
  recordCount: number;
  records: any[];
  errors: string[];
}

interface BulkImportDialogProps {
  onImportComplete?: () => void;
}

export const BulkImportDialog = ({ onImportComplete }: BulkImportDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

  const fetchReferenceData = async () => {
    const [branchesRes, vehiclesRes, categoriesRes] = await Promise.all([
      supabase.from('branches').select('*'),
      supabase.from('vehicles').select('*'),
      supabase.from('expense_categories').select('*').order('name')
    ]);
    
    if (branchesRes.data) setBranches(branchesRes.data);
    if (vehiclesRes.data) setVehicles(vehiclesRes.data);
    if (categoriesRes.data) setCategories(categoriesRes.data);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(selectedFiles);
    
    if (selectedFiles.length > 0) {
      await fetchReferenceData();
      await processFiles(selectedFiles);
    }
  };

  const processFiles = async (filesToProcess: File[]) => {
    try {
      const allRecords: any[] = [];
      const allErrors: string[] = [];

      for (const file of filesToProcess) {
        if (file.name.endsWith('.csv')) {
          const result = await parseCSVFile(file);
          allRecords.push(...result.records);
          allErrors.push(...result.errors);
        } else if (file.name.endsWith('.pdf')) {
          const result = await parsePDFWorkOrder(file);
          allRecords.push(...result.records);
          allErrors.push(...result.errors);
        }
      }

      const previewData = {
        fileName: filesToProcess.map(f => f.name).join(', '),
        fileType: filesToProcess.length === 1 ? filesToProcess[0].type : 'Multiple files',
        recordCount: allRecords.length,
        records: allRecords,
        errors: allErrors
      };

      setPreview(previewData);

      if (allErrors.length > 0) {
        toast({
          title: "Parsing Issues",
          description: `${allErrors.length} issues found. Review before importing.`,
          variant: "destructive"
        });
      }

      // Open the preview dialog
      if (allRecords.length > 0) {
        setPreviewDialogOpen(true);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process files",
        variant: "destructive"
      });
    }
  };

  const handlePreviewConfirm = async (editedEntries: PreviewExpenseEntry[]) => {
    setPreviewDialogOpen(false);
    setImporting(true);
    setProgress(0);

    try {
      // Filter to only entries with matched vehicles
      const validEntries = editedEntries.filter(e => e.matchedVehicle);
      const totalRecords = validEntries.length;
      let imported = 0;
      let failed = 0;

      for (const entry of validEntries) {
        try {
          const { error } = await supabase
            .from('expenses')
            .insert({
              vehicle_id: entry.matchedVehicle!.id,
              branch_id: entry.matchedBranch?.id || null,
              category_id: entry.matchedCategory?.id || null,
              amount: entry.amount,
              date: entry.date,
              odometer_reading: entry.odometer,
              description: entry.description || `Imported from ${preview?.fileName || 'historical data'}`
            });

          if (error) throw error;
          imported++;
        } catch (error) {
          console.error('Import error:', error);
          failed++;
        }

        setProgress(Math.round(((imported + failed) / totalRecords) * 100));
      }

      toast({
        title: "Import Complete",
        description: `Imported ${imported} records. ${failed > 0 ? `${failed} failed.` : ''}`,
      });

      setOpen(false);
      onImportComplete?.();
    } catch (error) {
      toast({
        title: "Import Failed",
        description: "An error occurred during import",
        variant: "destructive"
      });
    } finally {
      setImporting(false);
      setProgress(0);
      setFiles([]);
      setPreview(null);
    }
  };

  const handlePreviewCancel = () => {
    setPreviewDialogOpen(false);
    setPreview(null);
    setFiles([]);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Import Historical Data
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Import Historical Data</DialogTitle>
            <DialogDescription>
              Upload CSV or PDF files containing work orders and expense data from your previous fleet management system.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {!importing && (
              <div className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Input
                    type="file"
                    accept=".csv,.pdf"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-12 w-12 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Click to upload files</p>
                        <p className="text-sm text-muted-foreground">CSV or PDF files accepted</p>
                      </div>
                    </div>
                  </Label>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileSpreadsheet className="h-5 w-5 text-green-500" />
                      <span className="font-medium">CSV Format</span>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Expected columns: Date, Vehicle (VIN/Plate), Branch, Category, Amount, Description, Odometer
                    </p>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-5 w-5 text-red-500" />
                      <span className="font-medium">PDF Format</span>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Work orders with vehicle info, dates, amounts, and descriptions will be extracted automatically
                    </p>
                  </Card>
                </div>

                {preview && preview.errors.length > 0 && (
                  <Card className="p-4 border-yellow-500">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                      <span className="font-medium text-sm">Parsing Issues Found</span>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {preview.errors.slice(0, 5).map((error, idx) => (
                        <li key={idx}>• {error}</li>
                      ))}
                      {preview.errors.length > 5 && (
                        <li>• ... and {preview.errors.length - 5} more</li>
                      )}
                    </ul>
                  </Card>
                )}
              </div>
            )}

            {importing && (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="font-medium mb-2">Importing data...</p>
                  <Progress value={progress} className="w-full" />
                  <p className="text-sm text-muted-foreground mt-2">{progress}% complete</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {preview && (
        <ExpensePreviewDialog
          open={previewDialogOpen}
          onOpenChange={setPreviewDialogOpen}
          records={preview.records}
          vehicles={vehicles}
          branches={branches}
          categories={categories}
          fileName={preview.fileName}
          onConfirm={handlePreviewConfirm}
          onCancel={handlePreviewCancel}
        />
      )}
    </>
  );
};
