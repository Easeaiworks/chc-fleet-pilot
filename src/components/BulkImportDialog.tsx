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
import { mapImportData } from "@/utils/importMapper";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [mappings, setMappings] = useState<Record<string, string>>({});

  const fetchReferenceData = async () => {
    const [branchesRes, vehiclesRes] = await Promise.all([
      supabase.from('branches').select('*'),
      supabase.from('vehicles').select('*')
    ]);
    
    if (branchesRes.data) setBranches(branchesRes.data);
    if (vehiclesRes.data) setVehicles(vehiclesRes.data);
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

      setPreview({
        fileName: filesToProcess.map(f => f.name).join(', '),
        fileType: filesToProcess.length === 1 ? filesToProcess[0].type : 'Multiple files',
        recordCount: allRecords.length,
        records: allRecords,
        errors: allErrors
      });

      if (allErrors.length > 0) {
        toast({
          title: "Parsing Issues",
          description: `${allErrors.length} issues found. Review before importing.`,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process files",
        variant: "destructive"
      });
    }
  };

  const handleImport = async () => {
    if (!preview) return;

    setImporting(true);
    setProgress(0);

    try {
      const mappedData = mapImportData(preview.records, branches, vehicles, mappings);
      const totalRecords = mappedData.length;
      let imported = 0;
      let failed = 0;

      for (const record of mappedData) {
        try {
          const { error } = await supabase
            .from('expenses')
            .insert({
              vehicle_id: record.vehicle_id,
              category_id: record.category_id,
              amount: record.amount,
              date: record.date,
              odometer_reading: record.odometer_reading,
              description: record.description
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

  return (
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
          {!preview && (
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
            </div>
          )}

          {preview && !importing && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  {preview.errors.length === 0 ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                  )}
                  <div>
                    <p className="font-medium">{preview.fileName}</p>
                    <p className="text-sm text-muted-foreground">
                      {preview.recordCount} records found
                    </p>
                  </div>
                </div>
              </div>

              {preview.errors.length > 0 && (
                <Card className="p-4 border-yellow-500">
                  <p className="font-medium text-sm mb-2">Issues Found:</p>
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

              <div className="max-h-60 overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Vehicle</th>
                      <th className="p-2 text-left">Branch</th>
                      <th className="p-2 text-left">Amount</th>
                      <th className="p-2 text-left">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.records.slice(0, 10).map((record, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="p-2">{record.date}</td>
                        <td className="p-2">{record.vehicle}</td>
                        <td className="p-2">{record.branch}</td>
                        <td className="p-2">${record.amount}</td>
                        <td className="p-2">{record.category}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.recordCount > 10 && (
                  <p className="text-center text-sm text-muted-foreground p-2">
                    ... and {preview.recordCount - 10} more records
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={() => setPreview(null)} variant="outline" className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleImport} className="flex-1">
                  Import {preview.recordCount} Records
                </Button>
              </div>
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
  );
};
