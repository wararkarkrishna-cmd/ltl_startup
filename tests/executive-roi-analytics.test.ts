import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutiveRoiEngine } from '../src/lib/analytics/executive-roi-engine';
import { ExecutiveBoardReportGenerator } from '../src/lib/documents/executive-board-report-generator';
import { dbClient } from '../src/db/client';

describe('Phase 6.7: Real-Time Executive ROI Analytics & Board Report Generator', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';

  beforeEach(() => {
    dbClient.setTenantContext(tenantId);
  });

  it('aggregates provable software ROI across 4 value dimensions with positive net ROI multiple', async () => {
    const metrics = await ExecutiveRoiEngine.calculateExecutiveRoi(tenantId, 30);

    expect(metrics.tenantId).toBe(tenantId);
    expect(metrics.laborEfficiency.totalLaborHoursSaved).toBeGreaterThan(0);
    expect(metrics.laborEfficiency.totalLaborValueSavedCents).toBeGreaterThan(0);

    expect(metrics.splitOptimization.totalLinehaulSavedCents).toBeGreaterThan(0);
    expect(metrics.disputeRecovery.totalCreditsRecoveredCents).toBeGreaterThan(0);
    expect(metrics.quickpayFintech.totalFintechFeeRevenueCents).toBeGreaterThan(0);

    expect(metrics.platformSummary.totalEconomicValueGeneratedCents).toBeGreaterThan(
      metrics.platformSummary.estimatedPlatformSaaSMonthlyCostCents
    );
    expect(metrics.platformSummary.roiMultiplier).toBeGreaterThanOrEqual(1.0);
    expect(metrics.platformSummary.annualizedProjectedValueCents).toBeGreaterThan(0);
  });

  it('renders a professional Board of Directors Executive ROI Report vector PDF', async () => {
    const metrics = await ExecutiveRoiEngine.calculateExecutiveRoi(tenantId, 30);
    const pdfBuffer = await ExecutiveBoardReportGenerator.renderBoardReportPdf(metrics);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    expect(pdfBuffer.toString('utf-8', 0, 5)).toBe('%PDF-');
  });
});
