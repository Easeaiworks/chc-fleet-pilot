import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InspectionForm } from '@/components/InspectionForm';
import { InspectionReports } from '@/components/InspectionReports';
import { ClipboardCheck, FileText } from 'lucide-react';

export default function VehicleInspection() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vehicle Inspection</h1>
          <p className="text-muted-foreground">Monthly vehicle safety inspections</p>
        </div>

        <Tabs defaultValue="new" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="new" className="gap-2">
              <ClipboardCheck className="h-4 w-4" />
              <span className="hidden sm:inline">New Inspection</span>
              <span className="sm:hidden">New</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Reports</span>
              <span className="sm:hidden">Reports</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="mt-6">
            <InspectionForm />
          </TabsContent>

          <TabsContent value="reports" className="mt-6">
            <InspectionReports />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
