import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '../../../../../db/client';
import {
  DisputePackageGenerator,
  DisputePackageData,
} from '../../../../../lib/documents/dispute-package-generator';

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
    let dispute = await dbClient.getCarrierDisputeById(params.id);

    // If not found by ID, search by disputeReferenceNumber or Pro number
    if (!dispute) {
      for (const d of dbClient.carrierDisputes.values()) {
        if (
          (d.disputeReferenceNumber === params.id || d.carrierProNumber === params.id) &&
          d.tenantId === tenantId
        ) {
          dispute = d;
          break;
        }
      }
    }

    if (!dispute) {
      return NextResponse.json({ success: false, error: 'Dispute not found' }, { status: 404 });
    }

    if (format === 'json') {
      return NextResponse.json({ success: true, dispute });
    }

    const packageData = dispute.disputePackageData as unknown as DisputePackageData;

    if (format === 'html') {
      const html =
        dispute.htmlContent ||
        (packageData ? DisputePackageGenerator.renderDisputeHtml(packageData) : '<h1>Dispute Document</h1>');
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    if (format === 'pdf') {
      if (!packageData) {
        return NextResponse.json(
          { success: false, error: 'Dispute package payload is missing for PDF compilation' },
          { status: 400 }
        );
      }

      const pdfBuffer = await DisputePackageGenerator.generateDisputePdf(packageData);
      const storage = (await import('../../../../../lib/storage/document-storage')).getDocumentStorage();
      
      // Save dispute packet to Supabase Storage under disputes bucket
      storage.saveDocument(
        tenantId,
        `dispute-${dispute.disputeReferenceNumber}.pdf`,
        'application/pdf',
        pdfBuffer,
        'disputes'
      ).catch(() => {});

      return new Response(new Uint8Array(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="dispute-${dispute.disputeReferenceNumber}.pdf"`,
          'Content-Length': pdfBuffer.length.toString(),
        },
      });
    }


    return NextResponse.json(
      { success: false, error: `Unsupported format: ${format}. Supported: json, html, pdf` },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
