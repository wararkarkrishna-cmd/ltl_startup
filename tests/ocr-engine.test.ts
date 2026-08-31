import { describe, it, expect } from 'vitest';
import { OcrEngine } from '../src/lib/ocr/ocr-engine';
import { MultiModalFileProcessor } from '../src/lib/ingestion/file-processor';

describe('Optical Character Recognition (OCR) Engine', () => {
  it('processes text buffers and generates structured OCR tokens and lines', async () => {
    const rawBillText = Buffer.from(
      'BILL OF LADING\nCarrier: SAIA Freight\nOrigin: Los Angeles CA 90001\nDestination: Chicago IL 60601\n4 Pallets 3200 LBS Class 70',
      'utf-8'
    );

    const result = await OcrEngine.recognizeText(rawBillText);

    expect(result).toBeDefined();
    expect(result.text).toContain('BILL OF LADING');
    expect(result.text).toContain('SAIA Freight');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('integrates OCR with MultiModalFileProcessor for image uploads', async () => {
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
  });
});
