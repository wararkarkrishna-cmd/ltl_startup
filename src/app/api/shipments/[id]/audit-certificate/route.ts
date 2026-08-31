import { NextRequest, NextResponse } from 'next/server';
import { AuditEngine } from '@/lib/audit/audit-engine';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const shipmentId = params.id;
    const tenantId = req.headers.get('x-tenant-id') || 'default-tenant-apex';

    const certificate = await AuditEngine.generateCertificate(tenantId, shipmentId);

    return NextResponse.json({
      success: true,
      certificate,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to generate audit certificate' }, { status: 500 });
  }
}
