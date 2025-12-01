export const parseCSVFile = async (file: File): Promise<{ records: any[], errors: string[] }> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    const records: any[] = [];
    const errors: string[] = [];

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          errors.push('File appears to be empty or invalid');
          resolve({ records, errors });
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        // Expected columns (flexible matching)
        const dateCol = headers.findIndex(h => h.includes('date'));
        const vehicleCol = headers.findIndex(h => h.includes('vehicle') || h.includes('vin') || h.includes('plate'));
        const branchCol = headers.findIndex(h => h.includes('branch') || h.includes('location'));
        const categoryCol = headers.findIndex(h => h.includes('category') || h.includes('type'));
        const amountCol = headers.findIndex(h => h.includes('amount') || h.includes('cost') || h.includes('total'));
        const descCol = headers.findIndex(h => h.includes('description') || h.includes('notes'));
        const odometerCol = headers.findIndex(h => h.includes('odometer') || h.includes('km') || h.includes('mileage'));

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line.trim()) continue;

          // Handle CSV with potential commas in quoted fields
          const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
          
          if (values.length < 3) {
            errors.push(`Line ${i + 1}: Insufficient data`);
            continue;
          }

          const record: any = {
            date: dateCol >= 0 ? values[dateCol] : null,
            vehicle: vehicleCol >= 0 ? values[vehicleCol] : null,
            branch: branchCol >= 0 ? values[branchCol] : null,
            category: categoryCol >= 0 ? values[categoryCol] : 'Uncategorized',
            amount: amountCol >= 0 ? parseFloat(values[amountCol].replace(/[^0-9.-]/g, '')) : 0,
            description: descCol >= 0 ? values[descCol] : '',
            odometer: odometerCol >= 0 ? parseInt(values[odometerCol].replace(/[^0-9]/g, '')) : null,
            lineNumber: i + 1
          };

          // Validation
          if (!record.date || !record.vehicle || !record.amount) {
            errors.push(`Line ${i + 1}: Missing required fields (date, vehicle, or amount)`);
            continue;
          }

          // Validate and format date
          const parsedDate = new Date(record.date);
          if (isNaN(parsedDate.getTime())) {
            errors.push(`Line ${i + 1}: Invalid date format "${record.date}"`);
            continue;
          }
          record.date = parsedDate.toISOString().split('T')[0];

          if (record.amount <= 0) {
            errors.push(`Line ${i + 1}: Invalid amount "${record.amount}"`);
            continue;
          }

          records.push(record);
        }

        resolve({ records, errors });
      } catch (error) {
        errors.push(`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
        resolve({ records, errors });
      }
    };

    reader.onerror = () => {
      errors.push('Failed to read file');
      resolve({ records, errors });
    };

    reader.readAsText(file);
  });
};
