export const parsePDFWorkOrder = async (file: File): Promise<{ records: any[], errors: string[] }> => {
  const records: any[] = [];
  const errors: string[] = [];

  try {
    // Read file as text (for simple text-based PDFs)
    const arrayBuffer = await file.arrayBuffer();
    const text = new TextDecoder().decode(arrayBuffer);

    // Extract common patterns from work orders
    // Date patterns: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
    const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/g;
    
    // Amount patterns: $XXX.XX, XXX.XX, $XXX
    const amountPattern = /\$?\s*(\d{1,}[,\d]*\.?\d{0,2})/g;
    
    // VIN pattern: 17 alphanumeric characters
    const vinPattern = /\b[A-HJ-NPR-Z0-9]{17}\b/gi;
    
    // License plate patterns (various formats)
    const platePattern = /\b[A-Z0-9]{2,8}\b/g;

    const lines = text.split('\n');
    let currentRecord: any = null;
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;
      const trimmedLine = line.trim();
      
      if (!trimmedLine) continue;

      // Look for key indicators that start a new work order
      if (trimmedLine.toLowerCase().includes('work order') || 
          trimmedLine.toLowerCase().includes('invoice') ||
          trimmedLine.toLowerCase().includes('service')) {
        
        if (currentRecord && currentRecord.amount) {
          records.push(currentRecord);
        }
        
        currentRecord = {
          date: null,
          vehicle: null,
          branch: null,
          category: 'Work Order',
          amount: 0,
          description: '',
          odometer: null,
          source: file.name
        };
      }

      if (!currentRecord) {
        currentRecord = {
          date: null,
          vehicle: null,
          branch: null,
          category: 'Work Order',
          amount: 0,
          description: '',
          odometer: null,
          source: file.name
        };
      }

      // Extract date
      const dateMatch = trimmedLine.match(datePattern);
      if (dateMatch && !currentRecord.date) {
        try {
          const parsedDate = new Date(dateMatch[0]);
          if (!isNaN(parsedDate.getTime())) {
            currentRecord.date = parsedDate.toISOString().split('T')[0];
          }
        } catch (e) {
          // Invalid date, skip
        }
      }

      // Extract VIN
      const vinMatch = trimmedLine.match(vinPattern);
      if (vinMatch && !currentRecord.vehicle) {
        currentRecord.vehicle = vinMatch[0];
      }

      // Extract amounts
      if (trimmedLine.toLowerCase().includes('total') || 
          trimmedLine.toLowerCase().includes('amount') ||
          trimmedLine.toLowerCase().includes('cost')) {
        const amountMatch = trimmedLine.match(amountPattern);
        if (amountMatch) {
          const amount = parseFloat(amountMatch[0].replace(/[^0-9.]/g, ''));
          if (amount > currentRecord.amount) {
            currentRecord.amount = amount;
          }
        }
      }

      // Extract odometer
      if (trimmedLine.toLowerCase().includes('odometer') || 
          trimmedLine.toLowerCase().includes('mileage') ||
          trimmedLine.toLowerCase().includes('km')) {
        const odometerMatch = trimmedLine.match(/(\d{1,}[,\d]*)/);
        if (odometerMatch) {
          const odometer = parseInt(odometerMatch[0].replace(/,/g, ''));
          if (odometer > 100 && odometer < 999999) {
            currentRecord.odometer = odometer;
          }
        }
      }

      // Build description from relevant lines
      if (trimmedLine.length > 10 && trimmedLine.length < 200) {
        if (!trimmedLine.match(/^page\s+\d+/i) && 
            !trimmedLine.toLowerCase().includes('invoice') &&
            !trimmedLine.toLowerCase().includes('work order')) {
          currentRecord.description += (currentRecord.description ? ' ' : '') + trimmedLine;
        }
      }
    }

    // Add the last record
    if (currentRecord && currentRecord.amount > 0) {
      records.push(currentRecord);
    }

    // Validate records
    if (records.length === 0) {
      errors.push(`${file.name}: No valid work orders found. PDF may require manual entry.`);
    } else {
      records.forEach((record, idx) => {
        if (!record.date) {
          errors.push(`${file.name} Record ${idx + 1}: Missing date`);
        }
        if (!record.vehicle) {
          errors.push(`${file.name} Record ${idx + 1}: Vehicle VIN/Plate not found`);
        }
        if (record.description.length > 500) {
          record.description = record.description.substring(0, 500) + '...';
        }
      });
    }

  } catch (error) {
    errors.push(`${file.name}: Failed to parse PDF - ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return { records, errors };
};
