import { NextRequest, NextResponse } from 'next/server';
import { IngestionBenchmarkRunner } from '@/lib/benchmark/benchmark-runner';

export async function POST(_req: NextRequest) {
  try {
    const report = await IngestionBenchmarkRunner.runBenchmark();

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Benchmark failed' }, { status: 500 });
  }
}
