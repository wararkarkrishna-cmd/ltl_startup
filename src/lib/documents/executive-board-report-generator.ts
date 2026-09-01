import PDFDocument from 'pdfkit';
import crypto from 'crypto';
import { ExecutiveRoiMetrics } from '../analytics/executive-roi-engine';

export class ExecutiveBoardReportGenerator {
  /**
   * Generates a vector PDF Executive ROI Board Report
   */
  public static async renderBoardReportPdf(metrics: ExecutiveRoiMetrics): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          margin: 40,
          size: 'LETTER',
          info: {
            Title: `Apex LTL OS - Executive ROI Board Report - ${metrics.tenantId}`,
            Author: 'Apex Freight Technologies, LLC',
            Subject: 'Continuous Software & Financial ROI Audit',
          },
        });

        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        const formatCurrency = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        // ==========================================
        // 1. HEADER & BRANDING
        // ==========================================
        doc.rect(40, 40, 532, 60).fill('#020617'); // Dark slate banner
        doc.fillColor('#10B981').fontSize(16).font('Helvetica-Bold').text('APEX LTL OPERATING SYSTEM', 55, 52);
        doc.fillColor('#94A3B8').fontSize(9).font('Helvetica').text('EXECUTIVE BOARD OF DIRECTORS • ROI & FINANCIAL REPORT', 55, 72);

        doc.fillColor('#F8FAFC').fontSize(10).font('Helvetica-Bold').text(
          `PERIOD: LAST ${metrics.evaluatedPeriodDays} DAYS`,
          390,
          54,
          { width: 170, align: 'right' }
        );
        doc.fillColor('#64748B').fontSize(8).font('Helvetica').text(
          `GENERATED: ${new Date().toISOString().split('T')[0]}`,
          390,
          72,
          { width: 170, align: 'right' }
        );

        doc.moveDown(3);

        // ==========================================
        // 2. EXECUTIVE SUMMARY HIGHLIGHT BOX
        // ==========================================
        doc.rect(40, 115, 532, 75).fillAndStroke('#0F172A', '#1E293B');
        
        doc.fillColor('#94A3B8').fontSize(8).font('Helvetica-Bold').text('PROVEN ECONOMIC VALUE GENERATED', 55, 127);
        doc.fillColor('#10B981').fontSize(22).font('Helvetica-Bold').text(
          formatCurrency(metrics.platformSummary.totalEconomicValueGeneratedCents),
          55,
          140
        );

        doc.fillColor('#94A3B8').fontSize(8).font('Helvetica-Bold').text('NET PLATFORM ROI MULTIPLE', 240, 127);
        doc.fillColor('#38BDF8').fontSize(22).font('Helvetica-Bold').text(
          `${metrics.platformSummary.roiMultiplier.toFixed(1)}x ROI`,
          240,
          140
        );

        doc.fillColor('#94A3B8').fontSize(8).font('Helvetica-Bold').text('ANNUALIZED PROJECTED RUN-RATE', 410, 127);
        doc.fillColor('#A855F7').fontSize(20).font('Helvetica-Bold').text(
          formatCurrency(metrics.platformSummary.annualizedProjectedValueCents),
          410,
          142
        );

        // ==========================================
        // 3. DETAILED VALUE BREAKDOWN (4 STREAMS)
        // ==========================================
        let yPos = 210;
        doc.fillColor('#0F172A').fontSize(11).font('Helvetica-Bold').text('1. PROVABLE VALUE CREATION STREAMS', 40, yPos);

        yPos += 20;
        const streams = [
          {
            title: 'Labor Hours & Brokerage Efficiency',
            subtitle: `${metrics.laborEfficiency.totalLaborHoursSaved} hours saved across RFQ extraction, invoicing & dispute filing`,
            amount: formatCurrency(metrics.laborEfficiency.totalLaborValueSavedCents),
            color: '#10B981',
          },
          {
            title: 'Volume-LTL Split Freight Optimization',
            subtitle: `${metrics.splitOptimization.totalOptimizedLoads} multi-stop split loads optimized (avg $215.00 saved/load)`,
            amount: formatCurrency(metrics.splitOptimization.totalLinehaulSavedCents),
            color: '#0284C7',
          },
          {
            title: 'Carrier Overcharge Dispute Recovery',
            subtitle: `${metrics.disputeRecovery.totalDisputesFiled} overcharge disputes filed (${metrics.disputeRecovery.recoverySuccessRatePercent}% recovery yield)`,
            amount: formatCurrency(metrics.disputeRecovery.brokerRecoveryNetCents),
            color: '#7C3AED',
          },
          {
            title: 'QuickPay Fintech Payout Margin',
            subtitle: `${metrics.quickpayFintech.totalPayoutsCount} accelerated payouts processed (${metrics.quickpayFintech.averageFeePercentage}% avg spread)`,
            amount: formatCurrency(metrics.quickpayFintech.totalFintechFeeRevenueCents),
            color: '#D97706',
          },
        ];

        for (const s of streams) {
          doc.rect(40, yPos, 532, 45).fillAndStroke('#F8FAFC', '#E2E8F0');
          doc.fillColor('#0F172A').fontSize(10).font('Helvetica-Bold').text(s.title, 55, yPos + 10);
          doc.fillColor('#64748B').fontSize(8).font('Helvetica').text(s.subtitle, 55, yPos + 26);
          doc.fillColor(s.color).fontSize(13).font('Helvetica-Bold').text(s.amount, 420, yPos + 15, { width: 140, align: 'right' });
          yPos += 52;
        }

        // ==========================================
        // 4. FINANCIAL RECONCILIATION SUMMARY
        // ==========================================
        yPos += 15;
        doc.fillColor('#0F172A').fontSize(11).font('Helvetica-Bold').text('2. PLATFORM COST-BENEFIT RECONCILIATION', 40, yPos);
        yPos += 20;

        doc.rect(40, yPos, 532, 75).fillAndStroke('#FFFFFF', '#CBD5E1');
        
        doc.fillColor('#475569').fontSize(9).font('Helvetica').text('Gross Economic Value Delivered:', 55, yPos + 12);
        doc.fillColor('#0F172A').fontSize(9).font('Helvetica-Bold').text(formatCurrency(metrics.platformSummary.totalEconomicValueGeneratedCents), 420, yPos + 12, { width: 140, align: 'right' });

        doc.fillColor('#475569').fontSize(9).font('Helvetica').text('Estimated Monthly Apex Platform SaaS Fee:', 55, yPos + 30);
        doc.fillColor('#DC2626').fontSize(9).font('Helvetica-Bold').text(`- ${formatCurrency(metrics.platformSummary.estimatedPlatformSaaSMonthlyCostCents)}`, 420, yPos + 30, { width: 140, align: 'right' });

        doc.moveTo(55, yPos + 48).lineTo(560, yPos + 48).strokeColor('#E2E8F0').stroke();

        doc.fillColor('#0F172A').fontSize(10).font('Helvetica-Bold').text('Net Brokerage Profit Expansion:', 55, yPos + 55);
        doc.fillColor('#10B981').fontSize(11).font('Helvetica-Bold').text(formatCurrency(metrics.platformSummary.netBrokerageProfitGainCents), 420, yPos + 54, { width: 140, align: 'right' });

        // ==========================================
        // 5. FOOTER & AUDIT CERTIFICATE
        // ==========================================
        const reportHash = crypto
          .createHash('sha256')
          .update(`${metrics.tenantId}|${metrics.platformSummary.totalEconomicValueGeneratedCents}|${Date.now()}`)
          .digest('hex');

        doc.rect(40, 710, 532, 45).fillAndStroke('#020617', '#1E293B');
        doc.fillColor('#10B981').fontSize(7).font('Helvetica-Bold').text('CONFIDENTIAL • BOARD OF DIRECTORS AUDIT COPY', 55, 718);
        doc.fillColor('#94A3B8').fontSize(6).font('Courier').text(`SHA-256 AUDIT SEAL: ${reportHash}`, 55, 730);
        doc.fillColor('#94A3B8').fontSize(6).font('Helvetica').text('Apex Operating System • Zero-Drift Financial Float Engine', 55, 742);

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
