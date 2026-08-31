import { NextRequest, NextResponse } from 'next/server';
import { AuditEngine } from '@/lib/audit/audit-engine';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const shipmentId = params.id;
    const tenantId = req.headers.get('x-tenant-id') || 'default-tenant-apex';

    const history = await AuditEngine.getAuditHistory(tenantId, shipmentId);
    const integrity = await AuditEngine.verifyChainIntegrity(tenantId, shipmentId);

    return NextResponse.json({
      success: true,
      shipmentId,
      totalEvents: history.length,
      isChainIntact: integrity.isValid,
      integrityDetails: integrity,
      auditEvents: history,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch audit trail' }, { status: 500 });
  }
}
