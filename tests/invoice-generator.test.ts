import { describe, it, expect } from 'vitest';
import { InvoiceGenerator, InvoicePdfData } from '../src/lib/documents/invoice-generator';

describe('Phase 4.4: High-Resolution Customer Invoice & POD Certificate PDF Generator (InvoiceGenerator)', () => {
  const sampleInvoiceData: InvoicePdfData = {
    invoiceNumber: 'INV-2026-08842',
    invoiceDate: '2026-09-01',
    dueDate: '2026-10-01',
    paymentTermsDays: 30,
    paymentTermsLabel: 'Net 30',
    customerPoNumber: 'PO-GLOBAL-98421',

    billTo: {
      shipperName: 'Global Industrial Supply Co.',
      companyName: 'Global Industrial Supply Co.',
      addressLine1: '100 Industrial Parkway',
      addressLine2: 'Building 4B',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90001',
      contactName: 'Sarah Jenkins (AP Lead)',
      contactEmail: 'ap@globalsupply.com',
      contactPhone: '555-0192',
    },

    shipment: {
      referenceNumber: 'LTL-2026-8941',
      carrierName: 'SAIA LTL Freight',
      carrierScac: 'SAIA',
      proNumber: 'SAIA-984210',
      originCity: 'Los Angeles',
      originState: 'CA',
      originZip: '90001',
      destCity: 'Chicago',
      destState: 'IL',
      destZip: '60601',
      totalPallets: 4,
      totalWeightLbs: 3200,
      deliveryDate: '2026-09-01',
      consigneeName: 'Apex Distribution Hub',
      commodityDescription: 'Commercial HVAC Cooling Units',
    },

    linehaulAmountCents: 125000,   // $1,250.00
    fuelSurchargeCents: 18750,     // $187.50
    accessorials: [
      { code: 'LG_DEL', name: 'Liftgate Delivery Service', amountCents: 7500 },  // $75.00
      { code: 'INS_DEL', name: 'Inside Delivery Service', amountCents: 12500 }, // $125.00
    ],
    totalAmountCents: 163750,      // $1,637.50 (Exact integer math: 125000 + 18750 + 7500 + 12500)
    currency: 'USD',

    remittance: {
      bankName: 'JPMorgan Chase Bank, N.A.',
      routingNumber: '021000021',
      accountNumber: '984021984210',
      remitEmail: 'ap-billing@apexfreightos.com',
      remitAddress: 'Apex Freight Solutions LLC, 1000 Logistics Blvd Suite 500, Chicago, IL 60601',
    },

    podVerification: {
      podId: '01916362-7901-7080-867c-pod00000001',
      sha256Hash: 'a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8',
      submittedAt: '2026-09-01 14:30:00 UTC',
      deliveredAt: '2026-09-01 14:28:10 CST',
      consigneeSignerName: 'John Miller, Receiving Supervisor',
      gpsLatitude: 41.8781,
      gpsLongitude: -87.6298,
      geofenceDistanceMiles: 0.12,
      isWithinGeofence: true,
      pieceCountVerified: true,
      receivedPieces: 4,
      expectedPieces: 4,
      cleanDeliveryBadge: true,
      carrierScac: 'SAIA',
      proNumber: 'SAIA-984210',
    },
  };

  it('renders printable HTML invoice with zero floating point drift and itemized financial breakdown', () => {
    const html = InvoiceGenerator.renderInvoiceHtml(sampleInvoiceData);

    expect(html).toContain('APEX FREIGHT OS');
    expect(html).toContain('INV-2026-08842');
    expect(html).toContain('PO-GLOBAL-98421');
    expect(html).toContain('Global Industrial Supply Co.');
    expect(html).toContain('SAIA LTL Freight');
    expect(html).toContain('$1,250.00'); // Linehaul
    expect(html).toContain('$187.50');   // Fuel
    expect(html).toContain('$75.00');    // Liftgate
    expect(html).toContain('$125.00');   // Inside delivery
    expect(html).toContain('$1,637.50'); // Net Total
    expect(html).toContain('JPMorgan Chase Bank, N.A.');
    expect(html).toContain('021000021');
    // Page 2 POD Certification checks
    expect(html).toContain('PROOF OF DELIVERY (POD) CERTIFICATE');
    expect(html).toContain('John Miller, Receiving Supervisor');
    expect(html).toContain('a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8');
    expect(html).toContain('0.12 miles from receiver dock');
  });

  it('generates high-resolution 2-page binary PDF document buffer with PDFKit', async () => {
    const pdfBuffer = await InvoiceGenerator.generateInvoicePdf(sampleInvoiceData);

    expect(pdfBuffer).toBeDefined();
    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(2000);
    // PDF Magic Header %PDF
    expect(pdfBuffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
  });

  it('formats currency correctly without decimal rounding errors', () => {
    expect(InvoiceGenerator.formatCurrency(100)).toBe('$1.00');
    expect(InvoiceGenerator.formatCurrency(125000)).toBe('$1,250.00');
    expect(InvoiceGenerator.formatCurrency(18750)).toBe('$187.50');
    expect(InvoiceGenerator.formatCurrency(7500)).toBe('$75.00');
    expect(InvoiceGenerator.formatCurrency(0)).toBe('$0.00');
  });
});
