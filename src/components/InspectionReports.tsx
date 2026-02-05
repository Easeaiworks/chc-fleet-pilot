import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, subMonths } from 'date-fns';
import { CheckCircle, XCircle, ChevronDown, ChevronRight, Loader2, AlertTriangle, Printer, Calendar, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Inspection {
  id: string;
  vehicle_id: string;
  branch_id: string | null;
  inspection_date: string;
  inspection_month: string;
  kilometers: number | null;
  brakes_pass: boolean;
  brakes_notes: string | null;
  engine_pass: boolean;
  engine_notes: string | null;
  transmission_pass: boolean;
  transmission_notes: string | null;
  tires_pass: boolean;
  tires_notes: string | null;
  headlights_pass: boolean;
  headlights_notes: string | null;
  signal_lights_pass: boolean;
  signal_lights_notes: string | null;
  oil_level_pass: boolean;
  oil_level_notes: string | null;
  windshield_fluid_pass: boolean;
  windshield_fluid_notes: string | null;
  wipers_pass: boolean;
  wipers_notes: string | null;
  general_notes: string | null;
  created_at: string;
  vehicles?: { plate: string; make: string | null; model: string | null };
  branches?: { name: string };
}

interface Vehicle {
  id: string;
  plate: string;
}

interface Branch {
  id: string;
  name: string;
}

const INSPECTION_FIELDS = [
  { key: 'brakes', label: 'Brakes' },
  { key: 'engine', label: 'Engine' },
  { key: 'transmission', label: 'Transmission' },
  { key: 'tires', label: 'Tires' },
  { key: 'headlights', label: 'Headlights' },
  { key: 'signal_lights', label: 'Signal Lights' },
  { key: 'oil_level', label: 'Oil Level' },
  { key: 'windshield_fluid', label: 'Windshield Fluid' },
  { key: 'wipers', label: 'Wipers' },
];

export function InspectionReports() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Filters
  const [selectedMonth, setSelectedMonth] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');

  // Generate month options (last 12 months)
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(startOfMonth(date), 'yyyy-MM-dd'),
      label: format(date, 'MMMM yyyy'),
    };
  });

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchInspections();
  }, [selectedMonth, selectedVehicle, selectedBranch]);

  const fetchFilters = async () => {
    const [vehiclesRes, branchesRes] = await Promise.all([
      supabase.from('vehicles').select('id, plate').order('plate'),
      supabase.from('branches').select('id, name').order('name'),
    ]);

    if (vehiclesRes.data) setVehicles(vehiclesRes.data);
    if (branchesRes.data) setBranches(branchesRes.data);
  };

  const fetchInspections = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('vehicle_inspections')
        .select(`
          *,
          vehicles (plate, make, model),
          branches (name)
        `)
        .eq('inspection_month', selectedMonth)
        .order('inspection_date', { ascending: false });

      if (selectedVehicle !== 'all') {
        query = query.eq('vehicle_id', selectedVehicle);
      }
      if (selectedBranch !== 'all') {
        query = query.eq('branch_id', selectedBranch);
      }

      const { data, error } = await query;

      if (error) throw error;
      setInspections(data || []);
    } catch (error) {
      console.error('Error fetching inspections:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFailedItems = (inspection: Inspection) => {
    const failed: { label: string; notes: string | null }[] = [];
    INSPECTION_FIELDS.forEach(field => {
      const passKey = `${field.key}_pass` as keyof Inspection;
      const notesKey = `${field.key}_notes` as keyof Inspection;
      if (!inspection[passKey]) {
        failed.push({ label: field.label, notes: inspection[notesKey] as string | null });
      }
    });
    return failed;
  };

  const getPassCount = (inspection: Inspection) => {
    return INSPECTION_FIELDS.filter(field => {
      const passKey = `${field.key}_pass` as keyof Inspection;
      return inspection[passKey];
    }).length;
  };

  const handlePrint = () => {
    window.print();
  };

  // Summary stats
  const totalInspections = inspections.length;
  const inspectionsWithIssues = inspections.filter(i => getFailedItems(i).length > 0).length;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="print:hidden">
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  {monthOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Vehicle</Label>
              <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                <SelectTrigger>
                  <SelectValue placeholder="All vehicles" />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  <SelectItem value="all">All Vehicles</SelectItem>
                  {vehicles.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.plate}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Location</Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  <SelectItem value="all">All Locations</SelectItem>
                  {branches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Inspections</p>
            <p className="text-2xl font-bold">{totalInspections}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">With Issues</p>
            <p className="text-2xl font-bold text-destructive">{inspectionsWithIssues}</p>
          </CardContent>
        </Card>
      </div>

      {/* Print Button */}
      <div className="flex justify-end print:hidden">
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" />
          Print Report
        </Button>
      </div>

      {/* Inspection List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : inspections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No inspections found for the selected filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {inspections.map(inspection => {
            const failedItems = getFailedItems(inspection);
            const passCount = getPassCount(inspection);
            const isExpanded = expandedId === inspection.id;

            return (
              <Collapsible
                key={inspection.id}
                open={isExpanded}
                onOpenChange={() => setExpandedId(isExpanded ? null : inspection.id)}
              >
                <Card className={cn(
                  'transition-colors',
                  failedItems.length > 0 && 'border-destructive/50'
                )}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-base">
                              {inspection.vehicles?.plate}
                            </CardTitle>
                            <span className="text-sm text-muted-foreground">
                              {inspection.vehicles?.make} {inspection.vehicles?.model}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground flex-wrap">
                            <span>{format(new Date(inspection.inspection_date), 'MMM d, yyyy')}</span>
                            <span>•</span>
                            <span>{inspection.branches?.name}</span>
                            {inspection.kilometers && (
                              <>
                                <span>•</span>
                                <span>{inspection.kilometers.toLocaleString()} km</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={failedItems.length > 0 ? 'destructive' : 'secondary'}>
                            {passCount}/{INSPECTION_FIELDS.length}
                          </Badge>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {/* Show failed items summary when collapsed */}
                      {!isExpanded && failedItems.length > 0 && (
                        <div className="flex items-center gap-2 mt-2 text-sm text-destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <span>Issues: {failedItems.map(f => f.label).join(', ')}</span>
                        </div>
                      )}
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0 border-t">
                      <div className="grid gap-2 pt-4">
                        {INSPECTION_FIELDS.map(field => {
                          const passKey = `${field.key}_pass` as keyof Inspection;
                          const notesKey = `${field.key}_notes` as keyof Inspection;
                          const passed = inspection[passKey];
                          const notes = inspection[notesKey] as string | null;

                          return (
                            <div
                              key={field.key}
                              className={cn(
                                'flex items-start justify-between p-2 rounded',
                                passed ? 'bg-muted/50' : 'bg-destructive/10'
                              )}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  {passed ? (
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-destructive" />
                                  )}
                                  <span className="font-medium text-sm">{field.label}</span>
                                </div>
                                {notes && (
                                  <p className="text-sm text-muted-foreground mt-1 ml-6">
                                    {notes}
                                  </p>
                                )}
                              </div>
                              <Badge variant={passed ? 'secondary' : 'destructive'} className="text-xs">
                                {passed ? 'Pass' : 'Fail'}
                              </Badge>
                            </div>
                          );
                        })}

                        {/* General Notes Section */}
                        {inspection.general_notes && (
                          <div className="mt-4 p-3 bg-muted/50 rounded-lg border border-border">
                            <div className="flex items-start gap-2">
                              <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                              <div>
                                <span className="font-medium text-sm">General Notes / Concerns</span>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {inspection.general_notes}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
