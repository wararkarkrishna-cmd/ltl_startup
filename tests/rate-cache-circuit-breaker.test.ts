import { describe, it, expect, beforeEach } from 'vitest';
import { RateCache } from '../src/lib/cache/rate-cache';
import { CarrierCircuitBreaker } from '../src/lib/resilience/circuit-breaker';
import { RateRequest, CarrierQuoteResult } from '../src/lib/rating/carrier-adapter.interface';
import { PlatformRatingEngine } from '../src/lib/rating/platform-wholesale-engine';

describe('Phase 2.8: Redis Rate Caching & Circuit Breaker Architecture', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';

  beforeEach(() => {
    RateCache.clear();
  });

  const mockRequest: Omit<RateRequest, 'accountType'> = {
    tenantId,
    originZip: '90001',
    originCity: 'Los Angeles',
    originState: 'CA',
    destZip: '60601',
    destCity: 'Chicago',
    destState: 'IL',
    pickupDate: '2026-09-01',
    items: [
      { lengthIn: 48, widthIn: 40, heightIn: 48, weightLbs: 1000, quantity: 2, nmfcClass: '70' },
    ],
    accessorials: ['LIFTGATE_DELIVERY'],
  };

  it('generates consistent SHA-256 cache key and caches multi-carrier rates', () => {
    const key1 = RateCache.generateCacheKey(mockRequest);
    const key2 = RateCache.generateCacheKey(mockRequest);
    expect(key1).toBe(key2);
    expect(key1).toMatch(/^rate:[a-f0-9]{64}$/);

    const mockQuotes: CarrierQuoteResult[] = [
      {
        carrierCode: 'XPO',
        carrierName: 'XPO Logistics',
        carrierScac: 'CNWY',
        accountType: 'DIRECT_BYOC',
        sourceTag: '[DIRECT: XPO]',
        quoteNumber: 'XPO-1',
        linehaulCostCents: 40000,
        fuelSurchargeCents: 10000,
        accessorialCostCents: 7500,
        accessorialBreakdown: {},
        totalCostCents: 57500,
        transitDays: 3,
        isGuaranteed: false,
        timestamp: new Date().toISOString(),
      },
    ];

    RateCache.set(key1, mockQuotes);
    expect(RateCache.size()).toBe(1);

    const retrieved = RateCache.get(key1);
    expect(retrieved).toHaveLength(1);
    expect(retrieved![0].carrierCode).toBe('XPO');
    expect(RateCache.stats.hits).toBe(1);
  });

  it('evicts cached quotes when 900s TTL expires', () => {
    const key = RateCache.generateCacheKey(mockRequest);
    // Set with negative/zero TTL
    RateCache.set(key, [], -1000);

    const retrieved = RateCache.get(key);
    expect(retrieved).toBeNull();
    expect(RateCache.stats.evictions).toBe(1);
  });

  it('circuit breaker trips to OPEN after 3 consecutive failures', async () => {
    const breaker = new CarrierCircuitBreaker('TEST_CARRIER', {
      failureThreshold: 3,
      cooldownPeriodMs: 60000,
    });

    expect(breaker.getState()).toBe('CLOSED');

    const failingAction = async () => {
      throw new Error('Carrier API Gateway Timeout');
    };

    // 1st failure
    await expect(breaker.execute(failingAction)).rejects.toThrow();
    expect(breaker.getState()).toBe('CLOSED');

    // 2nd failure
    await expect(breaker.execute(failingAction)).rejects.toThrow();
    expect(breaker.getState()).toBe('CLOSED');

    // 3rd failure -> trips to OPEN
    await expect(breaker.execute(failingAction)).rejects.toThrow();
    expect(breaker.getState()).toBe('OPEN');

    // 4th call is blocked immediately without attempting network call
    await expect(breaker.execute(failingAction)).rejects.toThrow('Circuit is OPEN');
  });

  it('serves cached rating results on duplicate queries via PlatformRatingEngine', async () => {
    // 1st query: Cache miss -> calls carriers and caches
    const result1 = await PlatformRatingEngine.rateShipmentHybrid(mockRequest);
    expect(result1.fromCache).toBe(false);
    expect(RateCache.stats.sets).toBeGreaterThanOrEqual(1);

    // 2nd identical query: Served instantly from SHA-256 cache
    const result2 = await PlatformRatingEngine.rateShipmentHybrid(mockRequest);
    expect(result2.fromCache).toBe(true);
    expect(result2.quotes.length).toBe(result1.quotes.length);
    expect(RateCache.stats.hits).toBe(1);
  });
});
