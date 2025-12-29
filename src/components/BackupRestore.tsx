import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Download, Upload, AlertTriangle, FileWarning, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface StorageFile {
  name: string;
  path: string;
  contentBase64: string;
  contentType: string;
}

interface BackupData {
  version: string;
  created_at: string;
  tables: {
    branches: any[];
    vehicles: any[];
    expenses: any[];
    expense_categories: any[];
    documents: any[];
    gps_uploads: any[];
    profiles: any[];
    user_roles: any[];
    audit_logs: any[];
    vendors: any[];
    tire_inventory: any[];
    tire_claim_requests: any[];
    tire_changes: any[];
    vehicle_inspections: any[];
    manager_approvers: any[];
  };
  storage?: {
    vehicle_documents: StorageFile[];
  };
}

export function BackupRestore() {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingBackupData, setPendingBackupData] = useState<BackupData | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    setProgress(0);
    setProgressMessage('Fetching database tables...');

    try {
      // Fetch all tables in parallel
      const [
        branchesRes,
        vehiclesRes,
        expensesRes,
        categoriesRes,
        documentsRes,
        gpsUploadsRes,
        profilesRes,
        userRolesRes,
        auditLogsRes,
        vendorsRes,
        tireInventoryRes,
        tireClaimRequestsRes,
        tireChangesRes,
        vehicleInspectionsRes,
        managerApproversRes,
      ] = await Promise.all([
        supabase.from('branches').select('*'),
        supabase.from('vehicles').select('*'),
        supabase.from('expenses').select('*'),
        supabase.from('expense_categories').select('*'),
        supabase.from('documents').select('*'),
        supabase.from('gps_uploads').select('*'),
        supabase.from('profiles').select('*'),
        supabase.from('user_roles').select('*'),
        supabase.from('audit_logs').select('*'),
        supabase.from('vendors').select('*'),
        supabase.from('tire_inventory').select('*'),
        supabase.from('tire_claim_requests').select('*'),
        supabase.from('tire_changes').select('*'),
        supabase.from('vehicle_inspections').select('*'),
        supabase.from('manager_approvers').select('*'),
      ]);

      setProgress(30);

      // Check for errors
      const errors = [
        branchesRes.error,
        vehiclesRes.error,
        expensesRes.error,
        categoriesRes.error,
        documentsRes.error,
        gpsUploadsRes.error,
        profilesRes.error,
        userRolesRes.error,
        auditLogsRes.error,
        vendorsRes.error,
        tireInventoryRes.error,
        tireClaimRequestsRes.error,
        tireChangesRes.error,
        vehicleInspectionsRes.error,
        managerApproversRes.error,
      ].filter(Boolean);

      if (errors.length > 0) {
        throw new Error('Failed to fetch some tables: ' + errors.map(e => e?.message).join(', '));
      }

      // Fetch storage files from vehicle-documents bucket
      setProgressMessage('Fetching uploaded files...');
      const storageFiles: StorageFile[] = [];
      
      const { data: fileList, error: listError } = await supabase.storage
        .from('vehicle-documents')
        .list('', { limit: 1000 });

      if (!listError && fileList) {
        // Get all files recursively (check for folders)
        const allFiles: string[] = [];
        
        const fetchFilesRecursively = async (path: string = '') => {
          const { data: items } = await supabase.storage
            .from('vehicle-documents')
            .list(path, { limit: 1000 });
          
          if (items) {
            for (const item of items) {
              const fullPath = path ? `${path}/${item.name}` : item.name;
              if (item.id) {
                // It's a file
                allFiles.push(fullPath);
              } else {
                // It's a folder, recurse
                await fetchFilesRecursively(fullPath);
              }
            }
          }
        };

        await fetchFilesRecursively();
        
        setProgress(50);
        setProgressMessage(`Downloading ${allFiles.length} files...`);

        // Download each file and convert to base64
        for (let i = 0; i < allFiles.length; i++) {
          const filePath = allFiles[i];
          try {
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('vehicle-documents')
              .download(filePath);

            if (!downloadError && fileData) {
              const arrayBuffer = await fileData.arrayBuffer();
              const base64 = btoa(
                new Uint8Array(arrayBuffer).reduce(
                  (data, byte) => data + String.fromCharCode(byte),
                  ''
                )
              );
              
              storageFiles.push({
                name: filePath.split('/').pop() || filePath,
                path: filePath,
                contentBase64: base64,
                contentType: fileData.type,
              });
            }
          } catch (err) {
            console.warn(`Failed to download file: ${filePath}`, err);
          }
          
          setProgress(50 + Math.round((i / allFiles.length) * 40));
        }
      }

      setProgress(95);
      setProgressMessage('Creating backup file...');

      const backupData: BackupData = {
        version: '2.0',
        created_at: new Date().toISOString(),
        tables: {
          branches: branchesRes.data || [],
          vehicles: vehiclesRes.data || [],
          expenses: expensesRes.data || [],
          expense_categories: categoriesRes.data || [],
          documents: documentsRes.data || [],
          gps_uploads: gpsUploadsRes.data || [],
          profiles: profilesRes.data || [],
          user_roles: userRolesRes.data || [],
          audit_logs: auditLogsRes.data || [],
          vendors: vendorsRes.data || [],
          tire_inventory: tireInventoryRes.data || [],
          tire_claim_requests: tireClaimRequestsRes.data || [],
          tire_changes: tireChangesRes.data || [],
          vehicle_inspections: vehicleInspectionsRes.data || [],
          manager_approvers: managerApproversRes.data || [],
        },
        storage: {
          vehicle_documents: storageFiles,
        },
      };

      // Create and download the file
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `chc-fleet-backup-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setProgress(100);
      
      toast({
        title: 'Backup Created',
        description: `Backup includes ${backupData.tables.vehicles.length} vehicles, ${backupData.tables.expenses.length} expenses, ${storageFiles.length} files.`,
      });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: error.message || 'Failed to create backup',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
      setProgress(0);
      setProgressMessage('');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as BackupData;
        
        // Validate backup structure
        if (!data.version || !data.tables) {
          throw new Error('Invalid backup file format');
        }

        setPendingBackupData(data);
        setShowConfirmDialog(true);
      } catch (error: any) {
        toast({
          title: 'Invalid File',
          description: 'The selected file is not a valid backup file.',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
    
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRestore = async () => {
    if (!pendingBackupData) return;
    
    setShowConfirmDialog(false);
    setImporting(true);
    setProgress(0);

    try {
      const { tables, storage } = pendingBackupData;

      setProgressMessage('Clearing existing data...');
      
      // Delete existing data in reverse dependency order
      await supabase.from('tire_claim_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('tire_changes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('tire_inventory').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('vehicle_inspections').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('gps_uploads').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('vehicles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('expense_categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('vendors').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('manager_approvers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('branches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      // Note: We don't delete profiles or user_roles to preserve authentication

      setProgress(20);
      setProgressMessage('Restoring database tables...');

      // Insert data in dependency order
      if (tables.branches?.length > 0) {
        const { error } = await supabase.from('branches').upsert(tables.branches, { onConflict: 'id' });
        if (error) throw new Error(`Branches restore failed: ${error.message}`);
      }

      if (tables.expense_categories?.length > 0) {
        const { error } = await supabase.from('expense_categories').upsert(tables.expense_categories, { onConflict: 'id' });
        if (error) throw new Error(`Categories restore failed: ${error.message}`);
      }

      if (tables.vendors?.length > 0) {
        const { error } = await supabase.from('vendors').upsert(tables.vendors, { onConflict: 'id' });
        if (error) throw new Error(`Vendors restore failed: ${error.message}`);
      }

      if (tables.manager_approvers?.length > 0) {
        const { error } = await supabase.from('manager_approvers').upsert(tables.manager_approvers, { onConflict: 'id' });
        if (error) throw new Error(`Manager approvers restore failed: ${error.message}`);
      }

      if (tables.vehicles?.length > 0) {
        const { error } = await supabase.from('vehicles').upsert(tables.vehicles, { onConflict: 'id' });
        if (error) throw new Error(`Vehicles restore failed: ${error.message}`);
      }

      if (tables.expenses?.length > 0) {
        const { error } = await supabase.from('expenses').upsert(tables.expenses, { onConflict: 'id' });
        if (error) throw new Error(`Expenses restore failed: ${error.message}`);
      }

      if (tables.documents?.length > 0) {
        const { error } = await supabase.from('documents').upsert(tables.documents, { onConflict: 'id' });
        if (error) throw new Error(`Documents restore failed: ${error.message}`);
      }

      if (tables.gps_uploads?.length > 0) {
        const { error } = await supabase.from('gps_uploads').upsert(tables.gps_uploads, { onConflict: 'id' });
        if (error) throw new Error(`GPS uploads restore failed: ${error.message}`);
      }

      if (tables.tire_inventory?.length > 0) {
        const { error } = await supabase.from('tire_inventory').upsert(tables.tire_inventory, { onConflict: 'id' });
        if (error) throw new Error(`Tire inventory restore failed: ${error.message}`);
      }

      if (tables.tire_changes?.length > 0) {
        const { error } = await supabase.from('tire_changes').upsert(tables.tire_changes, { onConflict: 'id' });
        if (error) throw new Error(`Tire changes restore failed: ${error.message}`);
      }

      if (tables.tire_claim_requests?.length > 0) {
        const { error } = await supabase.from('tire_claim_requests').upsert(tables.tire_claim_requests, { onConflict: 'id' });
        if (error) throw new Error(`Tire claim requests restore failed: ${error.message}`);
      }

      if (tables.vehicle_inspections?.length > 0) {
        const { error } = await supabase.from('vehicle_inspections').upsert(tables.vehicle_inspections, { onConflict: 'id' });
        if (error) throw new Error(`Vehicle inspections restore failed: ${error.message}`);
      }

      if (tables.audit_logs?.length > 0) {
        const { error } = await supabase.from('audit_logs').upsert(tables.audit_logs, { onConflict: 'id' });
        if (error) throw new Error(`Audit logs restore failed: ${error.message}`);
      }

      setProgress(50);

      // Restore storage files
      const storageFiles = storage?.vehicle_documents || [];
      if (storageFiles.length > 0) {
        setProgressMessage(`Restoring ${storageFiles.length} files...`);
        
        for (let i = 0; i < storageFiles.length; i++) {
          const file = storageFiles[i];
          try {
            // Convert base64 back to blob
            const binaryString = atob(file.contentBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let j = 0; j < binaryString.length; j++) {
              bytes[j] = binaryString.charCodeAt(j);
            }
            const blob = new Blob([bytes], { type: file.contentType });

            // Upload to storage
            const { error: uploadError } = await supabase.storage
              .from('vehicle-documents')
              .upload(file.path, blob, { upsert: true });

            if (uploadError) {
              console.warn(`Failed to restore file: ${file.path}`, uploadError);
            }
          } catch (err) {
            console.warn(`Failed to restore file: ${file.path}`, err);
          }
          
          setProgress(50 + Math.round((i / storageFiles.length) * 45));
        }
      }

      setProgress(100);

      toast({
        title: 'Restore Complete',
        description: `Restored ${tables.vehicles?.length || 0} vehicles, ${tables.expenses?.length || 0} expenses, ${storageFiles.length} files.`,
      });

      // Refresh the page to show restored data
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      console.error('Restore error:', error);
      toast({
        title: 'Restore Failed',
        description: error.message || 'Failed to restore backup',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
      setProgress(0);
      setProgressMessage('');
      setPendingBackupData(null);
    }
  };

  const fileCount = pendingBackupData?.storage?.vehicle_documents?.length || 0;
  const isLegacyBackup = pendingBackupData?.version === '1.0';

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export Backup
            </CardTitle>
            <CardDescription>
              Download a complete backup of all fleet data including vehicles, expenses, uploaded files, and history.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>The backup includes:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>All vehicles and their details</li>
                  <li>Complete expense history</li>
                  <li>Branches, categories, and vendors</li>
                  <li>GPS mileage records</li>
                  <li>Vehicle inspections</li>
                  <li>Tire inventory and changes</li>
                  <li><strong>All uploaded receipt/document files</strong></li>
                  <li>Audit logs</li>
                </ul>
              </div>
              
              {exporting && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-xs text-muted-foreground text-center">{progressMessage}</p>
                </div>
              )}
              
              <Button 
                onClick={handleExport} 
                disabled={exporting}
                className="w-full"
              >
                {exporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Backup...
                  </>
                ) : 'Download Complete Backup'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Recommended: Save to Google Drive weekly for safekeeping.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Restore Backup
            </CardTitle>
            <CardDescription>
              Restore fleet data and files from a previously downloaded backup.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex gap-2 items-start">
                  <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-destructive">Warning</p>
                    <p className="text-muted-foreground">
                      Restoring will replace all existing fleet data and files. User accounts will be preserved.
                    </p>
                  </div>
                </div>
              </div>
              
              {importing && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-xs text-muted-foreground text-center">{progressMessage}</p>
                </div>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button 
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="w-full"
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Restoring...
                  </>
                ) : 'Select Backup File'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Restore</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>You are about to restore data from:</p>
              <div className="bg-muted p-3 rounded-md text-sm space-y-1">
                <p><strong>Backup Version:</strong> {pendingBackupData?.version || '1.0'}</p>
                <p><strong>Backup Date:</strong> {pendingBackupData?.created_at ? format(new Date(pendingBackupData.created_at), 'PPpp') : 'Unknown'}</p>
                <p><strong>Vehicles:</strong> {pendingBackupData?.tables.vehicles?.length || 0}</p>
                <p><strong>Expenses:</strong> {pendingBackupData?.tables.expenses?.length || 0}</p>
                <p><strong>Branches:</strong> {pendingBackupData?.tables.branches?.length || 0}</p>
                <p><strong>Files:</strong> {fileCount}</p>
              </div>
              
              {isLegacyBackup && (
                <div className="flex gap-2 items-start p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                  <FileWarning className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    This is a legacy backup (v1.0) and does not include uploaded files. Only database records will be restored.
                  </p>
                </div>
              )}
              
              <p className="text-destructive font-medium">
                This will replace all current fleet data. This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Restore Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
