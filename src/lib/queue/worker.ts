import { rfqIngestionQueue, IngestionJobResult } from './ingestion-queue';
import { MultiModalFileProcessor } from '../ingestion/file-processor';
import { LtlFreightExtractor } from '../extraction/llm-extractor';
import { getDocumentStorage } from '../storage/document-storage';
import { dbClient } from '../../db/client';

export function initializeIngestionWorker() {
  const storage = getDocumentStorage();

  rfqIngestionQueue.registerProcessor(async (job: IngestionJobResult) => {
    const { data } = job;
    rfqIngestionQueue.updateJobProgress(job.jobId, 15);

    let extractedText = '';
    let storageMetadata: any = null;

    if (data.rawBuffer) {
      // 1. Process File & Extract Text Streams
      const processed = await MultiModalFileProcessor.processFile(
        data.rawBuffer,
        data.mimeType,
        data.fileName
      );
      extractedText = processed.extractedText;
      rfqIngestionQueue.updateJobProgress(job.jobId, 45);

      // 2. Store file with SHA-256 in storage vault
      storageMetadata = await storage.saveDocument(
        data.tenantId,
        data.fileName,
        data.mimeType,
        data.rawBuffer
      );
      rfqIngestionQueue.updateJobProgress(job.jobId, 70);
    } else if (data.rawText) {
      extractedText = data.rawText;
      rfqIngestionQueue.updateJobProgress(job.jobId, 60);
    } else {
      throw new Error('Invalid job payload: Neither rawBuffer nor rawText provided');
    }

    // 3. Run LLM / Deterministic Structured Extraction
    const extractionResult = await LtlFreightExtractor.extractRfq(extractedText);
    rfqIngestionQueue.updateJobProgress(job.jobId, 90);

    // 4. Save Ingestion Document record into database
    dbClient.setTenantContext(data.tenantId);
    const docRecord = await dbClient.insertDocument({
      tenantId: data.tenantId,
      fileName: data.fileName,
      fileSizeBytes: data.rawBuffer ? data.rawBuffer.length : Buffer.from(extractedText).length,
      mimeType: data.mimeType,
      sha256Hash: storageMetadata ? storageMetadata.sha256Hash : storage.calculateSha256(Buffer.from(extractedText)),
      storagePath: storageMetadata ? storageMetadata.storagePath : 'inline://raw_text',
      sourceChannel: data.sourceChannel,
      extractionStatus: 'COMPLETED',
      rawExtractedText: extractedText,
      extractedJson: extractionResult as any,
    });

    rfqIngestionQueue.updateJobProgress(job.jobId, 100);

    return {
      documentId: docRecord.id,
      sha256Hash: docRecord.sha256Hash,
      extraction: extractionResult,
    };
  });
}

// Auto-initialize on import
initializeIngestionWorker();
