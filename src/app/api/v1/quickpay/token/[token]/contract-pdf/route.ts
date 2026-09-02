import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '@/db/client';
import { QuickPayContractEngine } from '@/lib/quickpay/quickpay-contract-engine';

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;
    const tokenRecord = await dbClient.getQuickPayToken(token);

    if (!tokenRecord) {
      return NextResponse.json(
        { success: false, error: 'QuickPay token not found' },
        { status: 404 }
      );
    }

    dbClient.setTenantContext(tokenRecord.tenantId);
    
    // Check if agreement already exists for this token or shipment
    let agreement = Array.from(dbClient.quickpayAgreements.values()).find(
      (a) => a.shipmentId === tokenRecord.shipmentId
    );

    if (!agreement) {
      // Create provisional agreement for PDF preview
      const result = QuickPayContractEngine.createAgreement({
        tenantId: tokenRecord.tenantId,
        payoutId: tokenRecord.id,
        shipmentId: tokenRecord.shipmentId,
        carrierScac: tokenRecord.carrierScac,
        carrierName: tokenRecord.carrierName,
        proNumber: tokenRecord.proNumber,
        bolNumber: tokenRecord.bolNumber,
        selectedTier: tokenRecord.defaultTier,
        grossAmountCents: tokenRecord.grossAmountCents,
        discountFeeCents: Math.round((tokenRecord.grossAmountCents * 2.5) / 100),
        netSettlementCents: tokenRecord.grossAmountCents - Math.round((tokenRecord.grossAmountCents * 2.5) / 100),
        signerName: 'Provisional Signer',
        signerTitle: 'Carrier Dispatch',
        signerEmail: tokenRecord.carrierEmail || 'billing@carrier.com',
        signerIp: '127.0.0.1',
      });
      agreement = result.agreement;
    }

    const pdfBuffer = await QuickPayContractEngine.renderAgreementPdf(agreement, {
      bankName: tokenRecord.bankName,
      routingMasked: tokenRecord.routingNumberMasked,
      accountMasked: tokenRecord.accountNumberMasked,
    });

    const storage = (await import('@/lib/storage/document-storage')).getDocumentStorage();
    storage.saveDocument(
      tokenRecord.tenantId,
      `QuickPay_Agreement_${agreement.agreementReference}.pdf`,
      'application/pdf',
      pdfBuffer,
      'shipment-documents'
    ).catch(() => {});

    return new Response(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="QuickPay_Agreement_${agreement.agreementReference}.pdf"`,
      },
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate contract PDF' },
      { status: 500 }
    );
  }
}
