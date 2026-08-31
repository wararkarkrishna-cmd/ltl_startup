import { NextRequest, NextResponse } from 'next/server';
import { LtlFreightExtractor } from '@/lib/extraction/llm-extractor';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Field "text" is required' }, { status: 400 });
    }

    const extraction = await LtlFreightExtractor.extractRfq(text);

    return NextResponse.json({
      success: true,
      extraction,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Extraction failed' }, { status: 500 });
  }
}
