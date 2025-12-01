export const mapImportData = (
  records: any[],
  branches: any[],
  vehicles: any[],
  manualMappings: Record<string, string>
) => {
  return records.map(record => {
    // Find matching vehicle by VIN, plate, or manual mapping
    let vehicleId = manualMappings[`vehicle_${record.vehicle}`];
    
    if (!vehicleId) {
      const vehicle = vehicles.find(v => 
        v.vin?.toLowerCase() === record.vehicle?.toLowerCase() ||
        v.plate?.toLowerCase() === record.vehicle?.toLowerCase() ||
        v.vin?.toLowerCase().includes(record.vehicle?.toLowerCase()) ||
        v.plate?.toLowerCase().includes(record.vehicle?.toLowerCase())
      );
      vehicleId = vehicle?.id;
    }

    // Find matching branch by name or manual mapping
    let branchId = manualMappings[`branch_${record.branch}`];
    
    if (!branchId && record.branch) {
      const branch = branches.find(b => 
        b.name?.toLowerCase() === record.branch?.toLowerCase() ||
        b.location?.toLowerCase().includes(record.branch?.toLowerCase())
      );
      branchId = branch?.id;
    }

    // If vehicle found, use its branch
    if (vehicleId && !branchId) {
      const vehicle = vehicles.find(v => v.id === vehicleId);
      if (vehicle) {
        branchId = vehicle.branch_id;
      }
    }

    return {
      vehicle_id: vehicleId,
      branch_id: branchId,
      category_id: null, // Will be set based on category name matching
      amount: record.amount,
      date: record.date,
      odometer_reading: record.odometer,
      description: record.description || `Imported from ${record.source || 'historical data'}`,
      created_at: new Date().toISOString()
    };
  }).filter(record => record.vehicle_id); // Only include records with valid vehicle mapping
};

export const createMissingVehicles = async (
  records: any[],
  vehicles: any[],
  supabase: any
) => {
  const uniqueVehicles = new Map<string, any>();
  
  records.forEach(record => {
    const vehicleKey = record.vehicle?.toLowerCase();
    if (!vehicleKey) return;
    
    const exists = vehicles.some(v => 
      v.vin?.toLowerCase() === vehicleKey ||
      v.plate?.toLowerCase() === vehicleKey
    );
    
    if (!exists && !uniqueVehicles.has(vehicleKey)) {
      uniqueVehicles.set(vehicleKey, {
        vin: record.vehicle.length === 17 ? record.vehicle : '',
        plate: record.vehicle.length !== 17 ? record.vehicle : '',
        make: 'Unknown',
        model: 'Unknown',
        year: 2025,
        status: 'active',
        branch_id: null
      });
    }
  });

  const newVehicles = Array.from(uniqueVehicles.values());
  
  if (newVehicles.length > 0) {
    const { data, error } = await supabase
      .from('vehicles')
      .insert(newVehicles)
      .select();
    
    return { created: data || [], error };
  }
  
  return { created: [], error: null };
};
