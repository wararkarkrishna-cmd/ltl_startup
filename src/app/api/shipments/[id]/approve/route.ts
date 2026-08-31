import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '@/db/client';
import { generateUuidV7 } from '@/lib/uuidv7';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const shipmentId = params.id;
    const body = await req.json();
    const {
      tenantId = 'default-tenant-apex',
      userId,
      updatedRfq,
      originalExtractedJson,
    } = body;

    dbClient.setTenantContext(tenantId);

    // Record CDC Audit Trail for manually overridden fields
    const auditEntries: any[] = [];
    if (originalExtractedJson && updatedRfq) {
      const keysToCompare = ['totalWeightLbs', 'totalPallets', 'accessorials'];
      for (const key of keysToCompare) {
        const oldVal = JSON.stringify(originalExtractedJson[key]);
        const newVal = JSON.stringify(updatedRfq[key]);
        if (oldVal !== newVal) {
          const auditId = generateUuidV7();
          const auditEvent = {
            id: auditId,
            tenantId,
            shipmentId,
            userId: userId || null,
            fieldName: key,
            oldValue: oldVal,
            newValue: newVal,
            source: 'USER_OVERRIDE',
            createdAt: new Date(),
          };
          dbClient.auditEvents.set(auditId, auditEvent);
          auditEntries.push(auditEvent);
        }
      }
    }

    return NextResponse.json({
      success: true,
      shipmentId,
      status: 'QUOTED',
      message: 'RFQ approved by broker. Ready for multi-carrier rating.',
      auditEventsRecorded: auditEntries.length,
      auditEntries,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Approval failed' }, { status: 500 });
  }
}
