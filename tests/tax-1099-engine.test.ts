import { describe, it, expect, beforeEach } from 'vitest';
import { Form1099TaxEngine, CarrierTaxSummary } from '../src/lib/quickpay/tax-1099-engine';
import { dbClient } from '../src/db/client';
import { generateUuidV7 } from '../src/lib/uuidv7';

describe('Phase 6.4: Automated IRS Form 1099-NEC Tax Compliance Engine', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';
  const currentYear = new Date().getFullYear();

  beforeEach(() => {
    dbClient.setTenantContext(tenantId);
    dbClient.carrierPayouts.clear();
    dbClient.form1099Records.clear();
  });

  it('aggregates annual carrier payouts and identifies carriers exceeding $600.00 threshold', async () => {
    // Carrier 1: SAIA ($850.00 gross -> Met)
    await dbClient.insertCarrierPayout({
      tenantId,
      shipmentId: generateUuidV7(),
      carrierScac: 'SAIA',
      carrierName: 'SAIA LTL Freight',
      carrierTin: '84-9928172',
      selectedTier: 'INSTANT_SAME_DAY',
      payoutRail: 'INSTANT_RTP',
      grossAmountCents: 85000,
      feePercentage: 2.5,
      feeAmountCents: 2125,
      netPayoutCents: 82875,
      currency: 'USD',
      status: 'SETTLED',
      settledAt: new Date(),
    });

    // Carrier 2: Roadrunner ($350.00 gross -> Under $600 threshold)
    await dbClient.insertCarrierPayout({
      tenantId,
      shipmentId: generateUuidV7(),
      carrierScac: 'RDFS',
      carrierName: 'Roadrunner Freight',
      carrierTin: '86-1234567',
      selectedTier: 'NEXT_DAY_ACH',
      payoutRail: 'SAME_DAY_ACH',
      grossAmountCents: 35000,
      feePercentage: 2.0,
      feeAmountCents: 700,
      netPayoutCents: 34300,
      currency: 'USD',
      status: 'SETTLED',
      settledAt: new Date(),
    });

    const summaries = await Form1099TaxEngine.aggregateTaxYearPayouts(tenantId, currentYear);

    expect(summaries.length).toBe(2);

    const saiaSummary = summaries.find((s) => s.carrierScac === 'SAIA');
    expect(saiaSummary).toBeDefined();
    expect(saiaSummary?.isThresholdMet).toBe(true);
    expect(saiaSummary?.totalGrossPayoutsCents).toBe(85000);

    const rdfsSummary = summaries.find((s) => s.carrierScac === 'RDFS');
    expect(rdfsSummary).toBeDefined();
    expect(rdfsSummary?.isThresholdMet).toBe(false);
    expect(rdfsSummary?.totalGrossPayoutsCents).toBe(35000);
  });

  it('renders compliant IRS Form 1099-NEC vector PDF document', async () => {
    const record = await dbClient.insertForm1099Record({
      tenantId,
      carrierScac: 'SAIA',
      taxYear: currentYear,
      carrierName: 'SAIA LTL Freight Services, Inc.',
      carrierTinEin: '84-9928172',
      carrierAddress: '115 Perimeter Center Place, Suite 700',
      carrierCity: 'Atlanta',
      carrierState: 'GA',
      carrierZip: '30346',
      box1NonemployeeCompensationCents: 4850000, // $48,500.00
      box4FederalTaxWithheldCents: 0,
      totalPayoutCount: 32,
      isThresholdMet: true,
      filingStatus: 'READY_TO_FILE',
    });

    const pdfBuffer = await Form1099TaxEngine.render1099NecPdf(record);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    expect(pdfBuffer.toString('utf-8', 0, 5)).toBe('%PDF-');
  });
});
