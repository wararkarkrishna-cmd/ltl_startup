import { NextRequest, NextResponse } from 'next/server';
import { Soc2ComplianceEngine } from '@/lib/security/soc2-compliance-engine';

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId') || '01916362-7901-7080-867c-9b8895092a01';
    const auditReport = await Soc2ComplianceEngine.runComplianceAudit(tenantId);

    return NextResponse.json({
      success: true,
      auditReport,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to run SOC2 compliance audit' },
      { status: 500 }
    );
  }
}
