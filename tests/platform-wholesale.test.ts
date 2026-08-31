import { describe, it, expect, beforeEach } from 'vitest';
import { PlatformRatingEngine } from '../src/lib/rating/platform-wholesale-engine';
import { RateRequest } from '../src/lib/rating/carrier-adapter.interface';
import { CredentialVault } from '../src/lib/security/credential-vault';
import { CarrierCredential } from '../src/db/schema';
import { RateCache } from '../src/lib/cache/rate-cache';

describe('Phase 2.3: Platform Wholesale Master Rate Injection & Multi-Carrier Aggregation', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';

  beforeEach(() => {
    RateCache.clear();
  });

  const baseRequest: Omit<RateRequest, 'accountType'> = {
    tenantId,
    originZip: '19102', // Philadelphia PA
    originCity: 'Philadelphia',
    originState: 'PA',
    destZip: '28202', // Charlotte NC
    destCity: 'Charlotte',
    destState: 'NC',
    pickupDate: '2026-09-01',
    items: [
      {
        lengthIn: 48,
        widthIn: 40,
        heightIn: 48,
        weightLbs: 1800,
        quantity: 3,
        nmfcClass: '70',
      },
    ],
    accessorials: ['LIFTGATE_DELIVERY'],
  };

  it('executes parallel multi-threading queries across all carriers in < 500ms', async () => {
    const result = await PlatformRatingEngine.rateShipmentHybrid(baseRequest, [], true);

    expect(result.quotes.length).toBe(10); // 5 Direct + 5 Wholesale
    expect(result.failedCarrierCount).toBe(0);
    expect(result.totalTimeMs).toBeLessThan(500);
  });

  it('tags every quote with unambiguous source badges [DIRECT] vs [PLATFORM WHOLESALE]', async () => {
    const result = await PlatformRatingEngine.rateShipmentHybrid(baseRequest, [], true);

    const directQuotes = result.quotes.filter((q) => q.accountType === 'DIRECT_BYOC');
    const wholesaleQuotes = result.quotes.filter((q) => q.accountType === 'PLATFORM_WHOLESALE');

    expect(directQuotes.length).toBe(5);
    expect(wholesaleQuotes.length).toBe(5);

    for (const dq of directQuotes) {
      expect(dq.sourceTag).toContain('[DIRECT:');
    }
    for (const wq of wholesaleQuotes) {
      expect(wq.sourceTag).toContain('[PLATFORM WHOLESALE:');
    }
  });

  it('calculates positive wholesale savings when master wholesale tier beats direct rate', async () => {
    const result = await PlatformRatingEngine.rateShipmentHybrid(baseRequest, [], true);

    expect(result.bestDirectQuote).toBeDefined();
    expect(result.bestWholesaleQuote).toBeDefined();
    expect(result.wholesaleSavingsCents).toBeGreaterThan(0);
    expect(result.bestWholesaleQuote!.totalCostCents).toBeLessThan(result.bestDirectQuote!.totalCostCents);
  });

  it('uses custom broker BYOC credentials when provided in tenant database', async () => {
    const encryptedKey = CredentialVault.encrypt('SAIA_SPECIAL_KEY_84920', tenantId);

    const customSaiaCred: CarrierCredential = {
      id: '01916362-7901-7080-867c-9b8895092c01',
      tenantId,
      carrierCode: 'SAIA',
      carrierName: 'SAIA LTL Freight',
      carrierScac: 'SAIA',
      accountNumber: '84920',
      accountType: 'DIRECT_BYOC',
      encryptedApiKey: encryptedKey.encryptedData,
      encryptedPassword: null,
      encryptedClientSecret: null,
      authTag: encryptedKey.authTag,
      iv: encryptedKey.iv,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await PlatformRatingEngine.rateShipmentHybrid(baseRequest, [customSaiaCred], true);

    const saiaDirect = result.quotes.find(
      (q) => q.carrierCode === 'SAIA' && q.accountType === 'DIRECT_BYOC'
    );
    expect(saiaDirect).toBeDefined();
    expect(saiaDirect?.sourceTag).toBe('[DIRECT: SAIA #84920]');
  });
});
