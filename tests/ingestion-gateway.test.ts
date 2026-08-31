import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { LocalStorageAdapter, calculateSha256 } from '../src/lib/storage/document-storage';
import { InboundEmailParser } from '../src/lib/ingestion/email-parser';
import { MultiModalFileProcessor } from '../src/lib/ingestion/file-processor';
import { IngestionTaskQueue } from '../src/lib/queue/ingestion-queue';
import { generateUuidV7 } from '../src/lib/uuidv7';

describe('Phase 1.2: Multi-Modal Ingestion Gateway', () => {
  const tenantId = generateUuidV7();

  describe('Document Storage Vault & SHA-256 Integrity', () => {
    it('calculates deterministic SHA-256 cryptographic hash of buffer', () => {
      const sampleData = Buffer.from('LTL Freight Bill of Lading - Apex Logistics 2026');
      const hash1 = calculateSha256(sampleData);
      const hash2 = calculateSha256(sampleData);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('stores files and verifies metadata in storage adapter', async () => {
      const storage = new LocalStorageAdapter();
      const content = Buffer.from('Sample Quote Request: 4 pallets 48x40x48 from 90001 to 60601');
      const meta = await storage.saveDocument(tenantId, 'quote_request.txt', 'text/plain', content);

      expect(meta.tenantId).toBe(tenantId);
      expect(meta.originalFileName).toBe('quote_request.txt');
      expect(meta.sizeBytes).toBe(content.length);
      expect(meta.sha256Hash).toBe(calculateSha256(content));

      const retrieved = await storage.getDocumentBuffer(meta.storagePath);
      expect(retrieved.toString('utf-8')).toBe(content.toString('utf-8'));
    });
  });

  describe('Inbound Email Parser (SendGrid & Mailgun)', () => {
    it('parses SendGrid webhook payload and extracts sender & attachments', () => {
      const attachmentBuffer = Buffer.from('PDF Rate Sheet Content');
      const sendGridPayload = {
        from: 'Sarah Shipper <sarah@acme-corp.com>',
        to: 'quotes@freightos.app',
        subject: 'URGENT: LTL Quote Request 4 Pallets LA to Chicago',
        text: 'Hi Team,\n\nPlease quote 4 pallets of auto parts from Los Angeles CA 90001 to Chicago IL 60601.\nTotal weight 4,800 lbs. Needs liftgate delivery.\n\nThanks,\nSarah',
      };

      const files = [
        {
          originalname: 'packing_slip.pdf',
          mimetype: 'application/pdf',
          buffer: attachmentBuffer,
        },
      ];

      const parsed = InboundEmailParser.parseSendGridWebhook(sendGridPayload, files);

      expect(parsed.fromEmail).toBe('sarah@acme-corp.com');
      expect(parsed.fromName).toBe('Sarah Shipper');
      expect(parsed.subject).toContain('URGENT: LTL Quote Request');
      expect(parsed.plainTextBody).toContain('4 pallets of auto parts');
      expect(parsed.attachments).toHaveLength(1);
      expect(parsed.attachments[0].filename).toBe('packing_slip.pdf');
      expect(parsed.attachments[0].sha256Hash).toBe(calculateSha256(attachmentBuffer));
    });

    it('parses raw RFC 822 email text format', () => {
      const rawEmail = `From: "John Dispatcher" <john@midwest3pl.com>
Subject: Spot Quote 2 Skids to Dallas
Date: Mon, 31 Aug 2026 09:00:00 -0500

Please quote 2 skids 48x40x60 @ 1200# each. Pickup 90210, Delivery 75201.`;

      const parsed = InboundEmailParser.parseRawEmailText(rawEmail);
      expect(parsed.fromEmail).toBe('john@midwest3pl.com');
      expect(parsed.fromName).toBe('John Dispatcher');
      expect(parsed.subject).toBe('Spot Quote 2 Skids to Dallas');
      expect(parsed.plainTextBody).toContain('2 skids 48x40x60 @ 1200# each');
    });
  });

  describe('Multi-Modal File Processor (PDF, Excel, CSV, Image)', () => {
    it('processes Excel workbook and converts sheets to structured text and tables', async () => {
      const wsData = [
        ['Item Number', 'Description', 'Quantity', 'Length', 'Width', 'Height', 'Weight (lbs)', 'NMFC Class'],
        ['SKU-001', 'Electric Motors', 4, 48, 40, 48, 1200, 70],
        ['SKU-002', 'Control Panels', 2, 48, 40, 60, 800, 85],
      ];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'ShipmentItems');
      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const result = await MultiModalFileProcessor.processFile(
        excelBuffer,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'freight_manifest.xlsx'
      );

      expect(result.tables).toBeDefined();
      expect(result.tables?.[0]).toHaveLength(2);
      expect(result.extractedText).toContain('Electric Motors');
      expect(result.extractedText).toContain('Control Panels');
    });

    it('processes CSV tabular files', async () => {
      const csvContent = `Qty,Description,Weight,Length,Width,Height,OriginZip,DestZip
2,Industrial Pumps,2400,48,40,55,90001,60601`;
      const csvBuffer = Buffer.from(csvContent);

      const result = await MultiModalFileProcessor.processFile(csvBuffer, 'text/csv', 'manifest.csv');
      expect(result.tables).toBeDefined();
      expect(result.tables?.[0][0].Description).toBe('Industrial Pumps');
      expect(result.tables?.[0][0].OriginZip).toBe('90001');
    });

    it('processes image attachments', async () => {
      const fakeImageBuffer = Buffer.from('fake-png-binary-data');
      const result = await MultiModalFileProcessor.processFile(fakeImageBuffer, 'image/png', 'rate_sheet.png');

      expect(result.mimeType).toBe('image/png');
      expect(result.metadata?.isImage).toBe(true);
    });
  });

  describe('Asynchronous Ingestion Queue & Exponential Backoff', () => {
    it('executes job lifecycle: QUEUED -> PROCESSING -> COMPLETED with progress tracking', async () => {
      const queue = new IngestionTaskQueue(3, 2);
      const progressUpdates: number[] = [];

      queue.registerProcessor(async (job) => {
        queue.updateJobProgress(job.jobId, 50);
        return { extractedLines: 4, success: true };
      });

      queue.on('progress', (job) => {
        progressUpdates.push(job.progress);
      });

      const job = await queue.addJob({
        tenantId,
        sourceChannel: 'UPLOAD',
        fileName: 'test_rfq.txt',
        mimeType: 'text/plain',
        rawText: 'Shipment of 4 pallets from 90001 to 60601',
      });

      expect(job.status).toBe('QUEUED');

      // Wait for async queue worker
      await new Promise((resolve) => setTimeout(resolve, 50));

      const completedJob = queue.getJob(job.jobId);
      expect(completedJob?.status).toBe('COMPLETED');
      expect(completedJob?.progress).toBe(100);
      expect(completedJob?.result.success).toBe(true);
      expect(progressUpdates).toContain(50);
    });

    it('handles retries with exponential backoff on transient errors', async () => {
      const queue = new IngestionTaskQueue(3, 1);
      let attemptCount = 0;

      queue.registerProcessor(async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Transient network timeout contacting OCR service');
        }
        return { recovered: true };
      });

      const job = await queue.addJob({
        tenantId,
        sourceChannel: 'RAW_TEXT',
        fileName: 'failing_rfq.txt',
        mimeType: 'text/plain',
        rawText: 'Test transient failure',
      });

      // Allow 1st attempt to fail and retry after 1s backoff
      await new Promise((resolve) => setTimeout(resolve, 1200));

      const status = queue.getJob(job.jobId);
      expect(status?.attempts).toBe(2);
      expect(status?.status).toBe('COMPLETED');
      expect(status?.result.recovered).toBe(true);
    });
  });
});
