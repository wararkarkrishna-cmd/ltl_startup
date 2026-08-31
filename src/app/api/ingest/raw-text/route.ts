import { NextRequest, NextResponse } from 'next/server';
import { rfqIngestionQueue } from '@/lib/queue/ingestion-queue';
import '@/lib/queue/worker';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, tenantId = 'default-tenant-apex' } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Field "text" is required' }, { status: 400 });
    }

    const job = await rfqIngestionQueue.addJob({
      tenantId,
      sourceChannel: 'RAW_TEXT',
      fileName: `raw_text_${Date.now()}.txt`,
      mimeType: 'text/plain',
      rawText: text,
    });

    return NextResponse.json({
      success: true,
      jobId: job.jobId,
      status: job.status,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
