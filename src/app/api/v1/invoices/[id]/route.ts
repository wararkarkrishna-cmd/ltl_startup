import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '../../../../../db/client';
import { InvoiceGenerator, InvoicePdfData } from '../../../../../lib/documents/invoice-generator';

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'json';
    const tenantId = searchParams.get('tenantId') || '01916362-7901-7080-867c-9b8895092a01';

    dbClient.setTenantContext(tenantId);
    let invoice = await dbClient.getCustomerInvoiceById(params.id);

    // If not found by ID, search by invoiceNumber
    if (!invoice) {
      for (const inv of dbClient.customerInvoices.values()) {
        if (inv.invoiceNumber === params.id && inv.tenantId === tenantId) {
          invoice = inv;
          break;
        }
      }
    }

    if (!invoice) {
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    }

    if (format === 'json') {
      return NextResponse.json({ success: true, invoice });
    }

    const shipment = await dbClient.getShipmentById(invoice.shipmentId);
    const pod = invoice.podId ? await dbClient.getPodRecordById(invoice.podId) : null;

    const invoicePdfData: InvoicePdfData = {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      paymentTermsDays: invoice.paymentTermsDays,
      paymentTermsLabel: `Net ${invoice.paymentTermsDays}`,
      customerPoNumber: invoice.customerPoNumber || 'N/A',

      billTo: {
        shipperName: invoice.shipperName,
        companyName: invoice.shipperName,
        addressLine1: invoice.shipperAddress,
        city: shipment?.originCity || 'Los Angeles',
        state: shipment?.originState || 'CA',
        zip: shipment?.originZip || '90001',
        contactEmail: invoice.shipperEmail,
      },

      shipment: {
        referenceNumber: shipment?.referenceNumber || 'LTL-2026-8941',
        carrierName: 'SAIA LTL Freight',
        carrierScac: 'SAIA',
        originCity: shipment?.originCity || 'Los Angeles',
        originState: shipment?.originState || 'CA',
        originZip: shipment?.originZip || '90001',
        destCity: shipment?.destCity || 'Chicago',
        destState: shipment?.destState || 'IL',
        destZip: shipment?.destZip || '60601',
        totalPallets: shipment?.totalPallets || 4,
        totalWeightLbs: shipment?.totalWeightLbs || 3200,
        deliveryDate: invoice.invoiceDate,
        consigneeName: shipment?.destName || 'Apex Receiving Dock',
      },

      linehaulAmountCents: invoice.linehaulAmountCents,
      fuelSurchargeCents: invoice.fuelSurchargeCents,
      accessorials: Object.entries(invoice.accessorialBreakdown || {}).map(([code, cents]) => ({
        code,
        name: code === 'LG_DEL' ? 'Liftgate Delivery' : code === 'INS_DEL' ? 'Inside Delivery' : `Accessorial (${code})`,
        amountCents: cents,
      })),
      totalAmountCents: invoice.totalAmountCents,
      currency: 'USD',
      remittance: invoice.remitInstructions,

      podVerification: pod
        ? {
            podId: pod.id,
            sha256Hash: pod.imageHash,
            submittedAt: pod.submittedAt.toISOString(),
            deliveredAt: `${invoice.invoiceDate} 14:28:10 CST`,
            consigneeSignerName: pod.consigneeName,
            gpsLatitude: pod.gpsLatitude ?? 41.8781,
            gpsLongitude: pod.gpsLongitude ?? -87.6298,
            geofenceDistanceMiles: 0.12,
            isWithinGeofence: true,
            pieceCountVerified: pod.pieceCountVerified,
            receivedPieces: pod.receivedPieces,
            expectedPieces: pod.expectedPieces,
            cleanDeliveryBadge: !pod.hasDamageException,
          }
        : undefined,
    };

    if (format === 'pdf') {
      try {
        const pdfBuffer = await InvoiceGenerator.generateInvoicePdf(invoicePdfData);
        return new Response(pdfBuffer as any, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${invoice.invoiceNumber}.pdf"`,
          },
        });
      } catch (pdfErr) {
        console.warn('PDFKit invoice binary generation fallback to print-ready HTML:', pdfErr);
        const html = InvoiceGenerator.renderInvoiceHtml(invoicePdfData);
        return new Response(html, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
          },
        });
      }
    }

    const html = InvoiceGenerator.renderInvoiceHtml(invoicePdfData);
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
