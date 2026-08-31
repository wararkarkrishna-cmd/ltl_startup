import { describe, it, expect } from 'vitest';
import { IngestionBenchmarkRunner } from '../src/lib/benchmark/benchmark-runner';
import { generateBenchmarkDataset } from '../src/lib/benchmark/rfq-dataset';
import { NextRequest } from 'next/server';
import { POST as handleBenchmarkApi } from '../src/app/api/benchmark/route';

describe('Phase 1.9: End-to-End Ingestion Integration Test Suite & OCR Benchmark Harness', () => {
  const dataset = generateBenchmarkDataset();

  it('contains at least 100 realistic anonymized freight test cases', () => {
    expect(dataset.length).toBeGreaterThanOrEqual(100);
  });

  it('passes strict benchmark regression assertions (ZIP >= 98.5%, Weight >= 99.0%, Acc >= 95.0%, Time < 3.5s)', async () => {
    const report = await IngestionBenchmarkRunner.runBenchmark(dataset);

    console.log(`\n============================================================`);
    console.log(`INGESTION BENCHMARK RESULTS (102 REAL-WORLD FREIGHT SAMPLES)`);
    console.log(`============================================================`);
    console.log(`Total Samples Evaluated:      ${report.totalSamples}`);
    console.log(`Total Execution Time:         ${report.totalExecutionTimeMs} ms (Target: < 3,500 ms)`);
    console.log(`Average Latency Per RFQ:      ${report.averageLatencyPerRfqMs} ms`);
    console.log(`ZIP Code Extraction Accuracy: ${report.zipExtractionAccuracy}% (Target: >= 98.5%)`);
    console.log(`Weight Extraction Accuracy:   ${report.weightAccuracy}% (Target: >= 99.0%)`);
    console.log(`Accessorial Accuracy:         ${report.accessorialAccuracy}% (Target: >= 95.0%)`);
    console.log(`Overall Benchmark Score:      ${report.overallBenchmarkScore} / 100`);
    console.log(`Passed All Thresholds:        ${report.passedAllThresholds ? 'YES (PASSED)' : 'NO (FAILED)'}`);
    console.log(`============================================================\n`);

    expect(report.zipExtractionAccuracy).toBeGreaterThanOrEqual(98.5);
    expect(report.weightAccuracy).toBeGreaterThanOrEqual(99.0);
    expect(report.accessorialAccuracy).toBeGreaterThanOrEqual(95.0);
    expect(report.totalExecutionTimeMs).toBeLessThan(3500);
    expect(report.passedAllThresholds).toBe(true);
  });

  it('POST /api/benchmark runs benchmark and returns metrics report', async () => {
    const req = new NextRequest('http://localhost:3000/api/benchmark', {
      method: 'POST',
    });

    const res = await handleBenchmarkApi(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.report.totalSamples).toBeGreaterThanOrEqual(100);
    expect(json.report.passedAllThresholds).toBe(true);
  });
});
