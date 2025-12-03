import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Download, Upload, AlertTriangle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
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
  };
}

export function BackupRestore() {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingBackupData, setPendingBackupData] = useState<BackupData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
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
      ]);

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
      ].filter(Boolean);

      if (errors.length > 0) {
        throw new Error('Failed to fetch some tables: ' + errors.map(e => e?.message).join(', '));
      }

      const backupData: BackupData = {
        version: '1.0',
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

      toast({
        title: 'Backup Created',
        description: `Backup file downloaded successfully. Contains ${
          backupData.tables.vehicles.length} vehicles, ${
          backupData.tables.expenses.length} expenses, and ${
          backupData.tables.branches.length} branches.`,
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

    try {
      const { tables } = pendingBackupData;

      // Delete existing data in reverse dependency order
      await supabase.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('gps_uploads').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('vehicles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('expense_categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('branches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      // Note: We don't delete profiles or user_roles to preserve authentication

      // Insert data in dependency order
      if (tables.branches?.length > 0) {
        const { error } = await supabase.from('branches').upsert(tables.branches, { onConflict: 'id' });
        if (error) throw new Error(`Branches restore failed: ${error.message}`);
      }

      if (tables.expense_categories?.length > 0) {
        const { error } = await supabase.from('expense_categories').upsert(tables.expense_categories, { onConflict: 'id' });
        if (error) throw new Error(`Categories restore failed: ${error.message}`);
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

      if (tables.audit_logs?.length > 0) {
        const { error } = await supabase.from('audit_logs').upsert(tables.audit_logs, { onConflict: 'id' });
        if (error) throw new Error(`Audit logs restore failed: ${error.message}`);
      }

      toast({
        title: 'Restore Complete',
        description: `Successfully restored ${tables.vehicles?.length || 0} vehicles, ${tables.expenses?.length || 0} expenses, and ${tables.branches?.length || 0} branches.`,
      });

      // Refresh the page to show restored data
      window.location.reload();
    } catch (error: any) {
      console.error('Restore error:', error);
      toast({
        title: 'Restore Failed',
        description: error.message || 'Failed to restore backup',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
      setPendingBackupData(null);
    }
  };

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
              Download a complete backup of all fleet data including vehicles, expenses, branches, and history.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>The backup includes:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>All vehicles and their details</li>
                  <li>Complete expense history</li>
                  <li>Branches and categories</li>
                  <li>GPS mileage records</li>
                  <li>Document references</li>
                  <li>Audit logs</li>
                </ul>
              </div>
              <Button 
                onClick={handleExport} 
                disabled={exporting}
                className="w-full"
              >
                {exporting ? 'Creating Backup...' : 'Download Backup'}
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
              Restore fleet data from a previously downloaded backup file.
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
                      Restoring will replace all existing fleet data. User accounts will be preserved.
                    </p>
                  </div>
                </div>
              </div>
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
                {importing ? 'Restoring...' : 'Select Backup File'}
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
              <div className="bg-muted p-3 rounded-md text-sm">
                <p><strong>Backup Date:</strong> {pendingBackupData?.created_at ? format(new Date(pendingBackupData.created_at), 'PPpp') : 'Unknown'}</p>
                <p><strong>Vehicles:</strong> {pendingBackupData?.tables.vehicles?.length || 0}</p>
                <p><strong>Expenses:</strong> {pendingBackupData?.tables.expenses?.length || 0}</p>
                <p><strong>Branches:</strong> {pendingBackupData?.tables.branches?.length || 0}</p>
              </div>
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
