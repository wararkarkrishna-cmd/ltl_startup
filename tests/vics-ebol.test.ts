import { describe, it, expect } from 'vitest';
import { VicsEbolGenerator, VicsEbolData } from '../src/lib/documents/ebol-generator';
import { GET as EbolGet } from '../src/app/api/v1/shipments/[id]/ebol/route';
import { NextRequest } from 'next/server';

describe('Phase 3.4: Standardized VICS Digital BOL (eBOL) PDF & HTML Generator', () => {
  const sampleEbolData: VicsEbolData = {
    bolNumber: 'BOL-2026-001928',
    masterBolNumber: 'BOL-2026-001928',
    proNumber: 'PRO-SAIA-984210',
    carrierName: 'SAIA LTL Freight',
    carrierScac: 'SAIA',
    trailerNumber: 'TR-53210',
    sealNumber: 'SL-99482',
    date: '2026-09-01',
    shipperName: 'Global Industrial Supply Co.',
    shipperAddress: '100 Industrial Pkwy',
    shipperCityStateZip: 'Los Angeles, CA 90001',
    shipperContact: 'Shipping Dock Desk (555-0192)',
    consigneeName: 'Midwest Distribution Logistics',
    consigneeAddress: '500 Logistics Way',
    consigneeCityStateZip: 'Chicago, IL 60601',
    consigneeContact: 'Receiving Dock Gate 4 (555-0198)',
    billToName: 'Apex Freight Solutions Escrow',
    billToAddress: '1000 Brokerage Center Suite 400',
    billToCityStateZip: 'Dallas, TX 75201',
    items: [
      {
        quantity: 4,
        packagingType: 'PALLET',
        weightLbs: 2400,
        commodityDescription: 'COMMERCIAL HVAC & HEATING UNITS',
        nmfcNumber: '156600',
        nmfcClass: '70',
        isHazmat: false,
        dimensionsIn: '48x40x48 IN',
      },
    ],
    accessorials: ['LIFTGATE_DELIVERY', 'NOTIFY_BEFORE_DELIVERY'],
    specialInstructions: 'Call receiver 24h before delivery. Liftgate required on arrival.',
    freightChargeTerm: 'PREPAID',
  };

  it('renders VICS-compliant HTML with GS1-128 barcode and structured shipper/consignee blocks', () => {
    const html = VicsEbolGenerator.renderVicsHtml(sampleEbolData);

    expect(html).toContain('VICS STANDARD BILL OF LADING');
    expect(html).toContain('BOL-2026-001928');
    expect(html).toContain('Global Industrial Supply Co.');
    expect(html).toContain('Midwest Distribution Logistics');
    expect(html).toContain('COMMERCIAL HVAC & HEATING UNITS');
    expect(html).toContain('CHEMTREC 1-800-424-9300');
    expect(html).toContain('<svg');
  });

  it('generates binary PDF buffer using PDFKit without errors', async () => {
    const pdfBuffer = await VicsEbolGenerator.generatePdfBuffer(sampleEbolData);

    expect(pdfBuffer).toBeDefined();
    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    // PDF Magic bytes: %PDF-
    expect(pdfBuffer.slice(0, 4).toString('utf8')).toBe('%PDF');
  });

  it('serves dynamic eBOL via GET /api/v1/shipments/[id]/ebol (HTML and PDF modes)', async () => {
    // HTML mode
    const htmlReq = new NextRequest('http://localhost:3000/api/v1/shipments/SHP-001928/ebol?format=html');
    const htmlRes = await EbolGet(htmlReq, { params: { id: 'SHP-001928' } });
    expect(htmlRes.status).toBe(200);
    expect(htmlRes.headers.get('content-type')).toContain('text/html');

    // PDF mode
    const pdfReq = new NextRequest('http://localhost:3000/api/v1/shipments/SHP-001928/ebol?format=pdf');
    const pdfRes = await EbolGet(pdfReq, { params: { id: 'SHP-001928' } });
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers.get('content-type')).toContain('application/pdf');
  });
});
