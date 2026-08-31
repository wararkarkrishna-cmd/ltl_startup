import { NextRequest, NextResponse } from 'next/server';
import { rfqIngestionQueue } from '@/lib/queue/ingestion-queue';
import '@/lib/queue/worker';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const tenantId = (formData.get('tenantId') as string) || 'default-tenant-apex';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const job = await rfqIngestionQueue.addJob({
      tenantId,
      sourceChannel: 'UPLOAD',
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      rawBuffer: buffer,
    });

    return NextResponse.json({
      success: true,
      jobId: job.jobId,
      status: job.status,
      message: 'File upload queued for multi-modal ingestion and extraction',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
