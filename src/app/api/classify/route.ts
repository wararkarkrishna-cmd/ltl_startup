import { NextRequest, NextResponse } from 'next/server';
import { LtlDensityCalculator } from '@/lib/classification/density-calculator';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Array of items is required' }, { status: 400 });
    }

    const densitySummary = LtlDensityCalculator.evaluateShipment(items);

    return NextResponse.json({
      success: true,
      classification: densitySummary,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Classification error' }, { status: 500 });
  }
}
