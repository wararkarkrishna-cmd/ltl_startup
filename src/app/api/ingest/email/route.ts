import { NextRequest, NextResponse } from 'next/server';
import { rfqIngestionQueue } from '@/lib/queue/ingestion-queue';
import { InboundEmailParser } from '@/lib/ingestion/email-parser';
import '@/lib/queue/worker';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let parsedEmail;

    if (contentType.includes('application/json')) {
      const body = await req.json();
      parsedEmail = InboundEmailParser.parseSendGridWebhook(body);
    } else {
      const rawText = await req.text();
      parsedEmail = InboundEmailParser.parseRawEmailText(rawText);
    }

    const tenantId = req.headers.get('x-tenant-id') || 'default-tenant-apex';

    const job = await rfqIngestionQueue.addJob({
      tenantId,
      sourceChannel: 'EMAIL_WEBHOOK',
      fileName: `email_${Date.now()}.txt`,
      mimeType: 'text/plain',
      rawText: `${parsedEmail.subject}\n${parsedEmail.plainTextBody}`,
      metadata: {
        from: parsedEmail.fromEmail,
        subject: parsedEmail.subject,
      },
    });

    return NextResponse.json({
      success: true,
      jobId: job.jobId,
      status: job.status,
      emailSubject: parsedEmail.subject,
      from: parsedEmail.fromEmail,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
