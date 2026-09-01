import { describe, it, expect, beforeEach } from 'vitest';
import { FactoringNoaEngine } from '../src/lib/quickpay/factoring-noa-engine';
import { dbClient } from '../src/db/client';
import { generateUuidV7 } from '../src/lib/uuidv7';

describe('Phase 6.6: Factoring Company API Hooks & Notice of Assignment (NOA) Routing Engine', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';
  const shipmentId = '01916362-7901-7080-867c-9b8895092s01';

  beforeEach(() => {
    dbClient.setTenantContext(tenantId);
    dbClient.factoringCompanies.clear();
    dbClient.carrierNoaRecords.clear();
    dbClient.factoringWaivers.clear();
  });

  it('authorizes direct carrier payout when no Notice of Assignment (NOA) is on file', async () => {
    const evalResult = await FactoringNoaEngine.evaluateCarrierFactoringStatus(
      tenantId,
      'ODFL',
      shipmentId,
      {
        bankName: 'Wells Fargo',
        routingNumber: '121000024',
        accountNumberMasked: '*****9921',
        email: 'billing@odfl.com',
      }
    );

    expect(evalResult.isFactored).toBe(false);
    expect(evalResult.isQuickPayAllowed).toBe(true);
    expect(evalResult.payoutRoutingMode).toBe('DIRECT_CARRIER');
    expect(evalResult.remittanceDestination.bankName).toBe('Wells Fargo');
  });

  it('redirects payout to Factoring Company Lockbox under UCC Article 9 when active NOA exists without waiver', async () => {
    await FactoringNoaEngine.seedStandardFactoringCompanies(tenantId);
    const triumph = (await dbClient.getFactoringCompanies(tenantId))[0];

    // Register active NOA for carrier
    await dbClient.insertCarrierNoaRecord({
      tenantId,
      carrierScac: 'TRCK',
      carrierName: 'Fast Trucking Corp',
      dotNumber: '998811',
      mcNumber: 'MC-112233',
      factoringCompanyId: triumph.id,
      noaStatus: 'ACTIVE',
      effectiveDate: new Date('2025-01-01'),
    });

    const evalResult = await FactoringNoaEngine.evaluateCarrierFactoringStatus(
      tenantId,
      'TRCK',
      shipmentId
    );

    expect(evalResult.isFactored).toBe(true);
    expect(evalResult.isQuickPayAllowed).toBe(false); // QuickPay blocked to protect against UCC Article 9 double-jeopardy
    expect(evalResult.payoutRoutingMode).toBe('REDIRECT_FACTORING_LOCKBOX');
    expect(evalResult.remittanceDestination.recipientName).toContain('Triumph');
    expect(evalResult.remittanceDestination.routingNumber).toBe(triumph.routingNumber);
  });

  it('unlocks QuickPay when an authorized Factoring Waiver is attached to the shipment', async () => {
    await FactoringNoaEngine.seedStandardFactoringCompanies(tenantId);
    const triumph = (await dbClient.getFactoringCompanies(tenantId))[0];

    await dbClient.insertCarrierNoaRecord({
      tenantId,
      carrierScac: 'TRCK',
      carrierName: 'Fast Trucking Corp',
      factoringCompanyId: triumph.id,
      noaStatus: 'ACTIVE',
      effectiveDate: new Date('2025-01-01'),
    });

    // Issue QuickPay waiver for this specific shipment
    const waiver = await FactoringNoaEngine.issueFactoringWaiver({
      tenantId,
      shipmentId,
      carrierScac: 'TRCK',
      factoringCompanyId: triumph.id,
      authorizedBy: 'Triumph Operations Portal API',
      durationDays: 14,
    });

    expect(waiver.authorizationCode).toMatch(/^QPW-TRCK-/);

    const evalResult = await FactoringNoaEngine.evaluateCarrierFactoringStatus(
      tenantId,
      'TRCK',
      shipmentId,
      {
        bankName: 'Chase Bank',
        routingNumber: '021000021',
        accountNumberMasked: '*****4411',
        email: 'billing@fasttrucking.com',
      }
    );

    expect(evalResult.isFactored).toBe(true);
    expect(evalResult.hasActiveWaiver).toBe(true);
    expect(evalResult.isQuickPayAllowed).toBe(true);
    expect(evalResult.payoutRoutingMode).toBe('QUICKPAY_WITH_WAIVER');
    expect(evalResult.remittanceDestination.bankName).toBe('Chase Bank');
  });
});
