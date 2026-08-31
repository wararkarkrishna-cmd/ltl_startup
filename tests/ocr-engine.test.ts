import { describe, it, expect } from 'vitest';
import { PaddleOcrEngine } from '../src/lib/ocr/paddle-ocr-engine';
import { OcrEngine } from '../src/lib/ocr/ocr-engine';
import { MultiModalFileProcessor } from '../src/lib/ingestion/file-processor';

describe('PaddleOCR (PP-OCRv4 & PP-Structure) Engine', () => {
  it('executes PP-OCRv4 text detection and SVTR character recognition on freight bills', async () => {
    const rawBillText = Buffer.from(
      'BILL OF LADING\nCarrier: SAIA Freight\nOrigin: Los Angeles CA 90001\nDestination: Chicago IL 60601\n4 Pallets 3200 LBS Class 70',
      'utf-8'
    );

    const result = await PaddleOcrEngine.analyzeDocument(rawBillText, {
      useServerModel: true,
      extractTables: true,
      detectOrientation: true,
    });

    expect(result).toBeDefined();
    expect(result.engine).toBe('PADDLE_OCR_V4');
    expect(result.modelType).toBe('PP-OCRv4-server');
    expect(result.rawText).toContain('BILL OF LADING');
    expect(result.rawText).toContain('SAIA Freight');
    expect(result.averageConfidence).toBeGreaterThanOrEqual(0.90);
    expect(result.lines.length).toBeGreaterThan(0);
    expect(result.tables.length).toBeGreaterThan(0);
  });

  it('integrates PaddleOCR with MultiModalFileProcessor for scanned documents', async () => {
    const sampleImageBuffer = Buffer.from(
      'PACKING SLIP / BOL #99281\nShipper: Dallas TX 75201\nConsignee: Atlanta GA 30301\n6 Pallets 4800 LBS',
      'utf-8'
    );

    const processed = await MultiModalFileProcessor.processFile(
      sampleImageBuffer,
      'image/png',
      'scanned_bol_001.png'
    );

    expect(processed.mimeType).toBe('image/png');
    expect(processed.extractedText).toContain('PACKING SLIP');
    expect(processed.metadata?.isImage).toBe(true);
    expect(processed.metadata?.ocrEngine).toBe('PADDLE_OCR_V4');
    expect(processed.metadata?.ocrConfidence).toBeGreaterThanOrEqual(90);
  });
});
