import { NextRequest, NextResponse } from 'next/server';
import { LtlFreightExtractor } from '@/lib/extraction/llm-extractor';
import { dbClient } from '@/db/client';
import { getDocumentStorage } from '@/lib/storage/document-storage';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, tenantId = '01916362-7901-7080-867c-9b8895092a01' } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Field "text" is required' }, { status: 400 });
    }

    const extraction = await LtlFreightExtractor.extractRfq(text);
    const storage = getDocumentStorage();

    // Persist to Supabase Database
    dbClient.setTenantContext(tenantId);
    const doc = await dbClient.insertDocument({
      tenantId,
      fileName: `rfq-extract-${Date.now()}.txt`,
      fileSizeBytes: Buffer.from(text).length,
      mimeType: 'text/plain',
      sha256Hash: storage.calculateSha256(Buffer.from(text)),
      storagePath: 'inline://raw_text',
      sourceChannel: 'RAW_TEXT',
      extractionStatus: 'COMPLETED',
      rawExtractedText: text,
      extractedJson: extraction as any,
    });

    return NextResponse.json({
      success: true,
      documentId: doc.id,
      sha256Hash: doc.sha256Hash,
      extraction,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Extraction failed' }, { status: 500 });
  }
}

