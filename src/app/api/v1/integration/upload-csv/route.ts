import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    let csvContent = '';
    let importType = 'accounts'; // default or 'fleet'

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ success: false, error: 'No file provided in request.' }, { status: 400 });
      }
      csvContent = await file.text();
      const typeFromForm = formData.get('type') as string | null;
      if (typeFromForm) importType = typeFromForm;
    } else {
      const body = await req.json();
      csvContent = body.csvText || body.csvContent || '';
      if (body.type) importType = body.type;
    }

    if (!csvContent || csvContent.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'CSV content is empty.' }, { status: 400 });
    }

    // Split lines
    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length <= 1) {
      return NextResponse.json(
        { success: false, error: 'CSV file must contain a header and at least one data row.' },
        { status: 400 }
      );
    }

    const headerRow = lines[0].toLowerCase();
    const headers = headerRow.split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));

    const isFleetCSV =
      importType === 'fleet' ||
      headers.includes('unit_number') ||
      headers.includes('unit') ||
      headers.includes('truck') ||
      headers.includes('equipment_type');

    const dataRows = lines.slice(1);
    const tenantId = '01916362-7901-7080-867c-9b8895092a01';

    let insertedAccountsCount = 0;
    let insertedTrucksCount = 0;
    const insertedAccounts: any[] = [];
    const insertedTrucks: any[] = [];

    if (isFleetCSV) {
      // Process Fleet & Carrier Trucks CSV
      for (const row of dataRows) {
        const cols = parseCSVRow(row);
        if (cols.length === 0) continue;

        const rowData: Record<string, string> = {};
        headers.forEach((h, idx) => {
          rowData[h] = cols[idx] || '';
        });

        const carrierName =
          rowData['carrier_name'] || rowData['carrier'] || rowData['company'] || 'Apex Dedicated Carrier';
        const mcNumber = rowData['mc_number'] || rowData['mc'] || `MC-${Math.floor(100000 + Math.random() * 900000)}`;
        const unitNumber =
          rowData['unit_number'] ||
          rowData['unit'] ||
          rowData['truck_number'] ||
          `TRK-${Math.floor(100 + Math.random() * 900)}`;

        let equipmentType = (rowData['equipment_type'] || rowData['equipment'] || 'DRY_VAN_53')
          .toUpperCase()
          .replace(/\s+/g, '_');
        if (
          !['DRY_VAN_53', 'REEFER_53', 'FLATBED_48', 'BOX_TRUCK_26', 'POWER_ONLY'].includes(equipmentType)
        ) {
          equipmentType = 'DRY_VAN_53';
        }

        // 1. Ensure carrier account exists or insert
        let carrierId: string | null = null;
        const { data: existingAccount } = await supabaseAdmin
          .from('accounts')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('name', carrierName)
          .maybeSingle();

        if (existingAccount) {
          carrierId = existingAccount.id;
        } else {
          const { data: newAcc } = await supabaseAdmin
            .from('accounts')
            .insert([
              {
                tenant_id: tenantId,
                name: carrierName,
                account_type: 'CARRIER',
                mc_number: mcNumber,
                dot_number: `DOT-${Math.floor(1000000 + Math.random() * 9000000)}`,
                contact_email: rowData['email'] || 'dispatch@carrierfleet.com',
                contact_phone: rowData['phone'] || '(555) 019-2834',
                billing_city: rowData['city'] || 'Chicago',
                billing_state: rowData['state'] || 'IL',
                billing_zip: rowData['zip'] || '60601',
              },
            ])
            .select()
            .single();

          if (newAcc) {
            carrierId = newAcc.id;
            insertedAccountsCount++;
            insertedAccounts.push(newAcc);
          }
        }

        // 2. Insert truck record into Supabase
        const maxWeight = parseInt(rowData['max_weight_lbs'] || rowData['max_weight'] || '45000', 10);
        const maxPallets = parseInt(rowData['max_pallets'] || rowData['pallets'] || '26', 10);
        const hasLiftgate =
          String(rowData['has_liftgate'] || rowData['liftgate']).toLowerCase() === 'true' ||
          equipmentType === 'BOX_TRUCK_26';

        const { data: newTruck, error: truckErr } = await supabaseAdmin
          .from('trucks')
          .insert([
            {
              tenant_id: tenantId,
              carrier_account_id: carrierId,
              unit_number: unitNumber.toUpperCase(),
              equipment_type: equipmentType,
              max_weight_lbs: isNaN(maxWeight) ? 45000 : maxWeight,
              max_pallets: isNaN(maxPallets) ? 26 : maxPallets,
              has_liftgate: hasLiftgate,
              status: rowData['status'] || 'AVAILABLE',
              current_location_zip: rowData['zip'] || '60601',
              current_city: rowData['city'] || 'Chicago',
              current_state: rowData['state'] || 'IL',
              assigned_driver_name: rowData['driver_name'] || rowData['driver'] || 'John Smith',
              assigned_driver_phone: rowData['driver_phone'] || '(555) 234-5678',
            },
          ])
          .select()
          .single();

        if (newTruck) {
          insertedTrucksCount++;
          insertedTrucks.push(newTruck);
        } else if (truckErr) {
          console.error('[upload-csv] Truck insert error:', truckErr);
        }
      }
    } else {
      // Process Customer / Shipper CSV
      for (const row of dataRows) {
        const cols = parseCSVRow(row);
        if (cols.length === 0) continue;

        const rowData: Record<string, string> = {};
        headers.forEach((h, idx) => {
          rowData[h] = cols[idx] || '';
        });

        const name =
          rowData['company_name'] ||
          rowData['company'] ||
          rowData['account_name'] ||
          rowData['name'] ||
          cols[0] ||
          'Unnamed Customer';

        if (!name || name === 'Unnamed Customer') continue;

        const { data: newAcc, error: accErr } = await supabaseAdmin
          .from('accounts')
          .insert([
            {
              tenant_id: tenantId,
              name: name,
              account_type: 'SHIPPER',
              contact_email: rowData['email'] || rowData['billing_email'] || 'ap@customer.com',
              contact_phone: rowData['phone'] || '(555) 123-4567',
              billing_city: rowData['city'] || 'Dallas',
              billing_state: rowData['state'] || 'TX',
              billing_zip: rowData['zip'] || '75001',
            },
          ])
          .select()
          .single();

        if (newAcc) {
          insertedAccountsCount++;
          insertedAccounts.push(newAcc);
        } else if (accErr) {
          console.error('[upload-csv] Account insert error:', accErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      importType: isFleetCSV ? 'FLEET' : 'CUSTOMERS',
      insertedAccountsCount: insertedAccountsCount,
      insertedTrucksCount: insertedTrucksCount,
      totalRowsProcessed: dataRows.length,
      accountsPreview: insertedAccounts.slice(0, 5),
      trucksPreview: insertedTrucks.slice(0, 5),
      message: isFleetCSV
        ? `Successfully ingested ${insertedTrucksCount} truck units and ${insertedAccountsCount} carrier accounts directly into Supabase.`
        : `Successfully ingested ${insertedAccountsCount} customer accounts directly into Supabase.`,
    });
  } catch (err: any) {
    console.error('[API /integration/upload-csv POST] Unexpected error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

function parseCSVRow(text: string): string[] {
  const result: string[] = [];
  let s = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(s.trim().replace(/^["']|["']$/g, ''));
      s = '';
    } else {
      s += c;
    }
  }
  result.push(s.trim().replace(/^["']|["']$/g, ''));
  return result;
}
