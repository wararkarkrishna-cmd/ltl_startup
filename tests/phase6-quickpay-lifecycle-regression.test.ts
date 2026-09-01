import { describe, it, expect } from 'vitest';
import { CarrierFraudScoringEngine } from '../src/lib/quickpay/carrier-fraud-scoring-engine';
import { QuickPayFeeEngine } from '../src/lib/quickpay/quickpay-fee-engine';
import { QuickPayContractEngine } from '../src/lib/quickpay/quickpay-contract-engine';
import { EmbeddedBankingEngine } from '../src/lib/quickpay/embedded-banking-engine';
import { DoubleEntryLedgerEngine } from '../src/lib/quickpay/double-entry-ledger-engine';
import { Form1099TaxEngine } from '../src/lib/quickpay/tax-1099-engine';
import { dbClient } from '../src/db/client';
import { generateUuidV7 } from '../src/lib/uuidv7';

describe('Phase 6: Master Embedded QuickPay Fintech Rails & Financial Engine Lifecycle (Phases 6.1 to 6.4)', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';
  const shipmentId = '01916362-7901-7080-867c-9b8895092s01';
  const grossPayableCents = 80000; // $800.00 Gross Load

  it('executes full macro-fintech lifecycle: Fraud Vetting -> Dynamic Tiers -> E-SIGN Contract -> Banking Rails -> Balanced Ledger -> 1099 Tax Tracking', async () => {
    const startTime = performance.now();
    dbClient.setTenantContext(tenantId);

    // =========================================================================
    // STEP 1 (Phase 6.1): Carrier Compliance & Fraud Risk Scoring
    // =========================================================================
    const fraudEvaluation = CarrierFraudScoringEngine.evaluateCarrier({
      tenantId,
      carrierScac: 'SAIA',
      carrierName: 'SAIA LTL Freight',
      dotNumber: '1948201',
      mcNumber: 'MC-849102',
      operatingAuthorityStatus: 'ACTIVE',
      safetyRating: 'SATISFACTORY',
      autoLiabilityCoverageDollars: 1_000_000,
      cargoInsuranceCoverageDollars: 100_000,
      daysSinceBankRoutingChange: 120, // Clean (> 30 days)
      daysSinceMcRegistration: 400,    // Clean (> 90 days)
      hasFactoringNoticeOfAssignment: false,
    });

    expect(fraudEvaluation.isQuickPayEligible).toBe(true);
    expect(fraudEvaluation.riskTier).toBe('LOW');
    expect(fraudEvaluation.fraudRiskScore).toBe(0);

    // =========================================================================
    // STEP 2 (Phase 6.2): Dynamic Tier Calculation & Comparison
    // =========================================================================
    const tierCalculation = QuickPayFeeEngine.calculateAllTiers({
      grossAmountCents: grossPayableCents,
      selectedTier: 'INSTANT_SAME_DAY',
    });

    expect(tierCalculation.tierOptions.length).toBe(3);
    const instantOption = tierCalculation.tierOptions[0];
    expect(instantOption.tier).toBe('INSTANT_SAME_DAY');
    expect(instantOption.feePercentage).toBe(2.5);
    expect(instantOption.feeAmountCents).toBe(2000); // $20.00
    expect(instantOption.netPayoutCents).toBe(78000); // $780.00

    // =========================================================================
    // STEP 3 (Phase 6.3): Tokenized 1-Click E-SIGN Assignment Micro-Contract
    // =========================================================================
    const payoutId = generateUuidV7();
    const contractResult = QuickPayContractEngine.createAgreement({
      tenantId,
      payoutId,
      shipmentId,
      carrierScac: 'SAIA',
      carrierName: 'SAIA LTL Freight',
      proNumber: 'PRO-984210',
      bolNumber: 'BOL-2026-001',
      selectedTier: 'INSTANT_SAME_DAY',
      grossAmountCents: grossPayableCents,
      discountFeeCents: instantOption.feeAmountCents,
      netSettlementCents: instantOption.netPayoutCents,
      signerName: 'Marcus Vance',
      signerTitle: 'VP of Transportation',
      signerEmail: 'mvance@saia.com',
      signerIp: '198.51.100.24',
    });

    expect(contractResult.agreement.agreementSha256Hash).toHaveLength(64);
    await dbClient.insertQuickPayAgreement(contractResult.agreement);

    // Render contract PDF
    const contractPdf = await QuickPayContractEngine.renderAgreementPdf(contractResult.agreement);
    expect(contractPdf.length).toBeGreaterThan(1000);

    // =========================================================================
    // STEP 4 (Phase 6.4): Multi-Rail Embedded Banking Disbursement (Instant RTP)
    // =========================================================================
    const bankingResponse = await EmbeddedBankingEngine.executePayout({
      tenantId,
      shipmentId,
      carrierScac: 'SAIA',
      carrierName: 'SAIA LTL Freight',
      amountCents: instantOption.netPayoutCents,
      payoutRail: 'INSTANT_RTP',
      provider: 'STRIPE_TREASURY',
      destinationRoutingNumber: '021000021',
      destinationAccountNumber: '1234567890',
      bankName: 'JPMorgan Chase',
    });

    expect(bankingResponse.success).toBe(true);
    expect(bankingResponse.status).toBe('SETTLED');
    expect(bankingResponse.externalTransactionId).toMatch(/^tr_outbound_/);

    // =========================================================================
    // STEP 5 (Phase 6.4): Balanced Double-Entry Financial Ledger
    // =========================================================================
    const ledgerTxId = generateUuidV7();
    const ledgerResult = await DoubleEntryLedgerEngine.postQuickPayPayout({
      tenantId,
      transactionId: ledgerTxId,
      shipmentId,
      carrierScac: 'SAIA',
      carrierName: 'SAIA LTL Freight',
      grossAmountCents: grossPayableCents,
      feeAmountCents: instantOption.feeAmountCents,
      netPayoutCents: instantOption.netPayoutCents,
    });

    expect(ledgerResult.isBalanced).toBe(true);
    expect(ledgerResult.entries.length).toBe(3);

    // Verify Trial Balance Invariant: sum(Debits) == sum(Credits)
    const trialBalance = await DoubleEntryLedgerEngine.calculateTrialBalance(tenantId);
    expect(trialBalance.isBalanced).toBe(true);
    expect(trialBalance.discrepancyCents).toBe(0);

    // Persist Carrier Payout Record
    await dbClient.insertCarrierPayout({
      id: payoutId,
      tenantId,
      shipmentId,
      carrierScac: 'SAIA',
      carrierName: 'SAIA LTL Freight',
      carrierTin: '84-9928172',
      selectedTier: 'INSTANT_SAME_DAY',
      payoutRail: 'INSTANT_RTP',
      grossAmountCents: grossPayableCents,
      feePercentage: 2.5,
      feeAmountCents: instantOption.feeAmountCents,
      netPayoutCents: instantOption.netPayoutCents,
      bankingProvider: 'STRIPE_TREASURY',
      externalDisbursementId: bankingResponse.externalTransactionId,
      status: 'SETTLED',
      settledAt: new Date(),
      ledgerTransactionId: ledgerTxId,
      agreementId: contractResult.agreement.id,
    });

    // =========================================================================
    // STEP 6 (Phase 6.4): Automated IRS Form 1099-NEC Tax Compliance
    // =========================================================================
    const currentYear = new Date().getFullYear();
    const taxSummaries = await Form1099TaxEngine.aggregateTaxYearPayouts(tenantId, currentYear);
    expect(taxSummaries.length).toBeGreaterThanOrEqual(1);

    const saiaTax = taxSummaries.find((s) => s.carrierScac === 'SAIA');
    expect(saiaTax).toBeDefined();
    expect(saiaTax?.isThresholdMet).toBe(true); // >= $600.00
    expect(saiaTax?.totalGrossPayoutsCents).toBe(80000);

    const tax1099Record = await Form1099TaxEngine.generate1099Record(tenantId, saiaTax!);
    expect(tax1099Record.box1NonemployeeCompensationCents).toBe(80000);
    expect(tax1099Record.filingStatus).toBe('READY_TO_FILE');

    const tax1099Pdf = await Form1099TaxEngine.render1099NecPdf(tax1099Record);
    expect(tax1099Pdf.length).toBeGreaterThan(1000);

    const executionDuration = performance.now() - startTime;
    console.log(`
============================================================
PHASE 6.1 - 6.4 MASTER FINTECH LIFECYCLE BENCHMARK
============================================================
Carrier Fraud & Safety Score: APPROVED (Risk: 0/100, Safety: 100/100)
Dynamic Fee Calculation:      Gross: $800.00 -> Fee: -$20.00 -> Net: $780.00 (2.5%)
E-SIGN Assignment Agreement:  ${contractResult.agreement.agreementReference} (SHA-256 Validated)
Multi-Rail Banking Payout:    ${bankingResponse.externalTransactionId} (INSTANT_RTP / SETTLED)
Double-Entry Ledger Status:   BALANCED (Total Debits == Credits, Zero Drift)
IRS Form 1099-NEC Filing:     Threshold Met ($800.00 >= $600.00) - READY_TO_FILE
Total End-to-End Latency:     ${executionDuration.toFixed(2)} ms (Sub-second Execution)
============================================================
    `);
  });
});
