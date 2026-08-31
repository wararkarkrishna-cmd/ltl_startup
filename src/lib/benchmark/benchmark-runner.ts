import { generateBenchmarkDataset, BenchmarkRfqItem } from './rfq-dataset';
import { LtlFreightExtractor } from '../extraction/llm-extractor';

export interface BenchmarkMetrics {
  totalSamples: number;
  totalExecutionTimeMs: number;
  averageLatencyPerRfqMs: number;
  zipExtractionAccuracy: number; // Percentage 0.0 - 100.0
  weightAccuracy: number; // Percentage 0.0 - 100.0
  accessorialAccuracy: number; // Percentage 0.0 - 100.0
  overallBenchmarkScore: number;
  passedAllThresholds: boolean;
  thresholds: {
    targetZipAccuracy: number; // 98.5%
    targetWeightAccuracy: number; // 99.0%
    targetAccessorialAccuracy: number; // 95.0%
    targetMaxExecutionTimeMs: number; // 3500ms
  };
  failures: Array<{
    id: string;
    category: string;
    reason: string;
    expected: any;
    actual: any;
  }>;
}

export class IngestionBenchmarkRunner {
  public static readonly TARGET_ZIP_ACCURACY = 98.5;
  public static readonly TARGET_WEIGHT_ACCURACY = 99.0;
  public static readonly TARGET_ACCESSORIAL_ACCURACY = 95.0;
  public static readonly TARGET_MAX_EXECUTION_TIME_MS = 3500;

  /**
   * Run the complete 100+ RFQ Ingestion Benchmark Suite
   */
  public static async runBenchmark(
    customDataset?: BenchmarkRfqItem[]
  ): Promise<BenchmarkMetrics> {
    const dataset = customDataset || generateBenchmarkDataset();
    const startTime = Date.now();

    let correctZipCount = 0;
    let correctWeightCount = 0;
    let correctAccessorialCount = 0;
    const failures: BenchmarkMetrics['failures'] = [];

    for (const item of dataset) {
      const extracted = await LtlFreightExtractor.extractRfq(item.rawText);

      // 1. Evaluate ZIP Code Extraction (Both Origin & Destination)
      const originZipMatch = extracted.origin.zip === item.groundTruth.originZip;
      const destZipMatch = extracted.destination.zip === item.groundTruth.destZip;

      if (originZipMatch && destZipMatch) {
        correctZipCount++;
      } else {
        failures.push({
          id: item.id,
          category: item.category,
          reason: 'ZIP Code mismatch',
          expected: { origin: item.groundTruth.originZip, dest: item.groundTruth.destZip },
          actual: { origin: extracted.origin.zip, dest: extracted.destination.zip },
        });
      }

      // 2. Evaluate Total Weight Accuracy (Within +/- 1% tolerance)
      const weightDiff = Math.abs(extracted.totalWeightLbs - item.groundTruth.totalWeightLbs);
      const isWeightAccurate = weightDiff / item.groundTruth.totalWeightLbs <= 0.01;

      if (isWeightAccurate) {
        correctWeightCount++;
      } else {
        failures.push({
          id: item.id,
          category: item.category,
          reason: 'Total weight mismatch',
          expected: item.groundTruth.totalWeightLbs,
          actual: extracted.totalWeightLbs,
        });
      }

      // 3. Evaluate Accessorial Detection Precision & Recall
      const expectedAccSet = new Set(item.groundTruth.accessorials);
      const extractedAccSet = new Set(extracted.accessorials);

      let isAccurate = true;
      for (const expectedAcc of expectedAccSet) {
        if (!extractedAccSet.has(expectedAcc)) {
          isAccurate = false;
          break;
        }
      }

      if (isAccurate) {
        correctAccessorialCount++;
      } else {
        failures.push({
          id: item.id,
          category: item.category,
          reason: 'Accessorial detection mismatch',
          expected: item.groundTruth.accessorials,
          actual: extracted.accessorials,
        });
      }
    }

    const totalTimeMs = Date.now() - startTime;
    const totalSamples = dataset.length;

    const zipAccuracy = parseFloat(((correctZipCount / totalSamples) * 100).toFixed(2));
    const weightAccuracy = parseFloat(((correctWeightCount / totalSamples) * 100).toFixed(2));
    const accessorialAccuracy = parseFloat(((correctAccessorialCount / totalSamples) * 100).toFixed(2));
    const averageLatencyPerRfqMs = parseFloat((totalTimeMs / totalSamples).toFixed(2));

    const overallBenchmarkScore = parseFloat(
      ((zipAccuracy + weightAccuracy + accessorialAccuracy) / 3).toFixed(2)
    );

    const passedAllThresholds =
      zipAccuracy >= this.TARGET_ZIP_ACCURACY &&
      weightAccuracy >= this.TARGET_WEIGHT_ACCURACY &&
      accessorialAccuracy >= this.TARGET_ACCESSORIAL_ACCURACY &&
      totalTimeMs <= this.TARGET_MAX_EXECUTION_TIME_MS;

    return {
      totalSamples,
      totalExecutionTimeMs: totalTimeMs,
      averageLatencyPerRfqMs,
      zipExtractionAccuracy: zipAccuracy,
      weightAccuracy,
      accessorialAccuracy,
      overallBenchmarkScore,
      passedAllThresholds,
      thresholds: {
        targetZipAccuracy: this.TARGET_ZIP_ACCURACY,
        targetWeightAccuracy: this.TARGET_WEIGHT_ACCURACY,
        targetAccessorialAccuracy: this.TARGET_ACCESSORIAL_ACCURACY,
        targetMaxExecutionTimeMs: this.TARGET_MAX_EXECUTION_TIME_MS,
      },
      failures,
    };
  }
}
