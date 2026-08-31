import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as handleExtract } from '../src/app/api/extract/route';
import { POST as handleRawText } from '../src/app/api/ingest/raw-text/route';
import { POST as handleEmail } from '../src/app/api/ingest/email/route';
import { GET as handleStatus } from '../src/app/api/ingest/status/[jobId]/route';
import { rfqIngestionQueue } from '../src/lib/queue/ingestion-queue';
import '../src/lib/queue/worker';

describe('Next.js Ingestion & Extraction API Routes', () => {
  it('POST /api/extract returns structured extraction result for raw text', async () => {
    const payload = {
      text: 'Need quote for 2 pallets 48x40x48 @ 1200# from Los Angeles CA 90001 to Chicago IL 60601 with liftgate delivery',
    };

    const req = new NextRequest('http://localhost:3000/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await handleExtract(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.extraction.totalPallets).toBe(2);
    expect(json.extraction.totalWeightLbs).toBe(2400);
    expect(json.extraction.accessorials).toContain('LG_DEL');
  });

  it('POST /api/ingest/raw-text queues a raw text ingestion job', async () => {
    const payload = {
      text: 'Quote 4 pallets 48x40x48 4000 lbs from 90001 to 60601',
      tenantId: 'tenant-test-123',
    };

    const req = new NextRequest('http://localhost:3000/api/ingest/raw-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await handleRawText(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.jobId).toBeDefined();
  });

  it('POST /api/ingest/email accepts webhook payload and queues job', async () => {
    const emailPayload = {
      from: 'Logistics Manager <manager@shipper.com>',
      to: 'inbound@freightos.app',
      subject: 'Quote 3 Skids Atlanta to Miami',
      text: '3 skids 48x40x60 2100 lbs from Atlanta GA 30301 to Miami FL 33101',
    };

    const req = new NextRequest('http://localhost:3000/api/ingest/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': 'tenant-test-123',
      },
      body: JSON.stringify(emailPayload),
    });

    const res = await handleEmail(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.jobId).toBeDefined();
    expect(json.from).toBe('manager@shipper.com');
  });

  it('GET /api/ingest/status/[jobId] retrieves job state and completed result', async () => {
    const job = await rfqIngestionQueue.addJob({
      tenantId: 'tenant-test-123',
      sourceChannel: 'RAW_TEXT',
      fileName: 'status_check.txt',
      mimeType: 'text/plain',
      rawText: '2 pallets 48x40x48 1500 lbs from 90001 to 60601',
    });

    // Allow worker to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    const req = new NextRequest(`http://localhost:3000/api/ingest/status/${job.jobId}`);
    const res = await handleStatus(req, { params: { jobId: job.jobId } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.jobId).toBe(job.jobId);
    expect(json.status).toBe('COMPLETED');
    expect(json.progress).toBe(100);
    expect(json.result).toBeDefined();
    expect(json.result.extraction.totalPallets).toBe(2);
  });
});
