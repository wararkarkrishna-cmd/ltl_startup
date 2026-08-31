import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '../../../../../../db/client';
import { VicsEbolGenerator, VicsEbolData } from '../../../../../../lib/documents/ebol-generator';

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'html';
    const tenantId = searchParams.get('tenantId') || '01916362-7901-7080-867c-9b8895092a01';

    dbClient.setTenantContext(tenantId);
    const shipment = await dbClient.getShipmentById(params.id);

    const masterBolNumber = `BOL-2026-${params.id.slice(-6).toUpperCase()}`;

    const ebolData: VicsEbolData = {
      bolNumber: masterBolNumber,
      masterBolNumber,
      proNumber: `PRO-SAIA-984210`,
      carrierName: 'SAIA LTL Freight',
      carrierScac: 'SAIA',
      trailerNumber: 'TR-53210',
      sealNumber: 'SL-99482',
      date: new Date().toISOString().split('T')[0],
      shipperName: shipment?.originName || 'Global Industrial Supply Co.',
      shipperAddress: shipment?.originAddress1 || '100 Industrial Pkwy',
      shipperCityStateZip: `${shipment?.originCity || 'Los Angeles'}, ${shipment?.originState || 'CA'} ${shipment?.originZip || '90001'}`,
      shipperContact: shipment?.originContactName || 'Shipping Dock Desk (555-0192)',
      consigneeName: shipment?.destName || 'Midwest Distribution Logistics',
      consigneeAddress: shipment?.destAddress1 || '500 Logistics Way',
      consigneeCityStateZip: `${shipment?.destCity || 'Chicago'}, ${shipment?.destState || 'IL'} ${shipment?.destZip || '60601'}`,
      consigneeContact: shipment?.destContactName || 'Receiving Dock Gate 4 (555-0198)',
      billToName: 'Apex Freight Solutions Escrow',
      billToAddress: '1000 Brokerage Center Suite 400',
      billToCityStateZip: 'Dallas, TX 75201',
      items: [
        {
          quantity: shipment?.totalPallets || 4,
          packagingType: 'PALLET',
          weightLbs: shipment?.totalWeightLbs || 2400,
          commodityDescription: 'COMMERCIAL HVAC & HEATING UNITS',
          nmfcNumber: '156600',
          nmfcClass: '70',
          isHazmat: false,
          dimensionsIn: '48x40x48 IN',
        },
      ],
      accessorials: ['LIFTGATE_DELIVERY', 'NOTIFY_BEFORE_DELIVERY'],
      specialInstructions: shipment?.specialInstructions || 'Call receiver 24h before delivery. Liftgate required on arrival.',
      freightChargeTerm: 'PREPAID',
    };

    if (format === 'pdf') {
      const pdfBuffer = await VicsEbolGenerator.generatePdfBuffer(ebolData);
      return new Response(pdfBuffer as any, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="eBOL_${masterBolNumber}.pdf"`,
        },
      });
    }

    const html = VicsEbolGenerator.renderVicsHtml(ebolData);
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
