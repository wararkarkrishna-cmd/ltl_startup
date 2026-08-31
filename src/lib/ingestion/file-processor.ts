import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import pdfParse from 'pdf-parse';
import { OcrEngine } from '../ocr/ocr-engine';

export interface ProcessedDocumentResult {
  mimeType: string;
  extractedText: string;
  pageCount?: number;
  tables?: Array<Array<Record<string, any>>>;
  metadata?: Record<string, any>;
}

export class MultiModalFileProcessor {
  /**
   * Main File Ingestion Processor Dispatcher
   */
  public static async processFile(
    buffer: Buffer,
    mimeType: string,
    fileName: string
  ): Promise<ProcessedDocumentResult> {
    const normalizedMime = mimeType.toLowerCase();

    if (normalizedMime.includes('pdf') || fileName.endsWith('.pdf')) {
      return this.processPdf(buffer);
    }

    if (
      normalizedMime.includes('spreadsheetml') ||
      normalizedMime.includes('excel') ||
      fileName.endsWith('.xlsx') ||
      fileName.endsWith('.xls')
    ) {
      return this.processExcel(buffer);
    }

    if (normalizedMime.includes('csv') || fileName.endsWith('.csv')) {
      return this.processCsv(buffer);
    }

    if (
      normalizedMime.includes('image/') ||
      /\.(png|jpe?g|webp)$/i.test(fileName)
    ) {
      return this.processImage(buffer, normalizedMime);
    }

    return {
      mimeType: 'text/plain',
      extractedText: buffer.toString('utf-8'),
    };
  }

  /**
   * PDF Document Stream & Text Extraction
   */
  public static async processPdf(buffer: Buffer): Promise<ProcessedDocumentResult> {
    try {
      const data = await pdfParse(buffer);
      return {
        mimeType: 'application/pdf',
        extractedText: data.text.trim(),
        pageCount: data.numpages,
        metadata: {
          info: data.info,
          version: data.version,
        },
      };
    } catch (err: any) {
      const rawFallback = buffer.toString('binary').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
      return {
        mimeType: 'application/pdf',
        extractedText: rawFallback.trim(),
        pageCount: 1,
      };
    }
  }

  /**
   * Excel Multi-Sheet Tabular Extraction & Normalization
   */
  public static async processExcel(buffer: Buffer): Promise<ProcessedDocumentResult> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const tables: Array<Array<Record<string, any>>> = [];
    let aggregatedText = '';

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
      tables.push(jsonData);

      aggregatedText += `--- SHEET: ${sheetName} ---\n`;
      const csvData = XLSX.utils.sheet_to_csv(sheet);
      aggregatedText += csvData + '\n\n';
    }

    return {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extractedText: aggregatedText.trim(),
      tables,
      metadata: {
        sheetNames: workbook.SheetNames,
      },
    };
  }

  /**
   * CSV Tabular Parsing & Normalization
   */
  public static async processCsv(buffer: Buffer): Promise<ProcessedDocumentResult> {
    const csvString = buffer.toString('utf-8');
    const parsed = Papa.parse(csvString, {
      header: true,
      skipEmptyLines: true,
    });

    return {
      mimeType: 'text/csv',
      extractedText: csvString.trim(),
      tables: [parsed.data as Array<Record<string, any>>],
      metadata: {
        rowCount: parsed.data.length,
        errors: parsed.errors,
      },
    };
  }

  /**
   * Image OCR Extraction using Tesseract.js Optical Engine
   */
  public static async processImage(
    buffer: Buffer,
    mimeType: string
  ): Promise<ProcessedDocumentResult> {
    const ocrResult = await OcrEngine.recognizeText(buffer);
    return {
      mimeType: mimeType || 'image/png',
      extractedText: ocrResult.text,
      metadata: {
        isImage: true,
        ocrConfidence: ocrResult.confidence,
        lineCount: ocrResult.lines.length,
        processingTimeMs: ocrResult.processingTimeMs,
      },
    };
  }
}
