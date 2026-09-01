import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '../../../../../db/client';
import { DisputePackageGenerator } from '../../../../../lib/documents/dispute-package-generator';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tenantId = '01916362-7901-7080-867c-9b8895092a01',
      carrierInvoiceId,
      discrepancyId,
      disputeType,
      customNotes,
      autoRoute = true,
    } = body;

    if (!carrierInvoiceId) {
      return NextResponse.json(
        { success: false, error: 'carrierInvoiceId is required to compile dispute package' },
        { status: 400 }
      );
    }

    dbClient.setTenantContext(tenantId);

    const dispute = await DisputePackageGenerator.compileAndCreateDispute({
      tenantId,
      carrierInvoiceId,
      discrepancyId,
      disputeType,
      customNotes,
      autoRoute,
    });

    return NextResponse.json({
      success: true,
      dispute,
      routing: {
        claimDeskEmail: dispute.assignedClaimEmail,
        carrierScac: dispute.carrierScac,
        carrierProNumber: dispute.carrierProNumber,
        statutoryResponseDays: dispute.statutoryResponseDeadlineDays,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
