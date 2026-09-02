import {
  ICarrierRatingAdapter,
  RateRequest,
  CarrierQuoteResult,
} from './carrier-adapter.interface';
import { XpoRatingAdapter } from './adapters/xpo-adapter';
import { EstesRatingAdapter } from './adapters/estes-adapter';
import { SaiaRatingAdapter } from './adapters/saia-adapter';
import { AbfRatingAdapter } from './adapters/abf-adapter';
import { RlRatingAdapter } from './adapters/rl-adapter';
import { CarrierCredential } from '../../db/schema';
import { CredentialVault } from '../security/credential-vault';
import { RateCache } from '../cache/rate-cache';
import { CarrierCircuitBreaker } from '../resilience/circuit-breaker';

export interface AggregatedRatingResult {
  quotes: CarrierQuoteResult[];
  failedCarrierCount: number;
  totalTimeMs: number;
  fromCache?: boolean;
  bestDirectQuote?: CarrierQuoteResult;
  bestWholesaleQuote?: CarrierQuoteResult;
  wholesaleSavingsCents: number; // Potential savings using platform master wholesale tier vs direct
}

export class PlatformRatingEngine {
  private static readonly ADAPTERS: Record<string, ICarrierRatingAdapter> = {
    XPO: new XpoRatingAdapter(),
    ESTES: new EstesRatingAdapter(),
    SAIA: new SaiaRatingAdapter(),
    ABF: new AbfRatingAdapter(),
    RL: new RlRatingAdapter(),
  };

  private static readonly CIRCUIT_BREAKERS: Record<string, CarrierCircuitBreaker> = {
    XPO: new CarrierCircuitBreaker('XPO'),
    ESTES: new CarrierCircuitBreaker('ESTES'),
    SAIA: new CarrierCircuitBreaker('SAIA'),
    ABF: new CarrierCircuitBreaker('ABF'),
    RL: new CarrierCircuitBreaker('RL'),
  };

  /**
   * Execute Hybrid Multi-Carrier Rating (Direct BYOC + Platform Master Wholesale Tiers)
   * Queries all active carrier connectors concurrently in parallel threads (Promise.allSettled)
   * with Redis/SHA-256 caching and per-carrier circuit breakers.
   */
  public static async rateShipmentHybrid(
    baseRequest: Omit<RateRequest, 'accountType'>,
    activeDirectCredentials: CarrierCredential[] = [],
    bypassCache: boolean = false
  ): Promise<AggregatedRatingResult> {
    const startTime = Date.now();

    // 0. Check SHA-256 Rate Cache (900s TTL)
    const cacheKey = RateCache.generateCacheKey(baseRequest);
    if (!bypassCache) {
      const cachedQuotes = RateCache.get(cacheKey);
      if (cachedQuotes && cachedQuotes.length > 0) {
        const directQuotes = cachedQuotes.filter((q) => q.accountType === 'DIRECT_BYOC');
        const wholesaleQuotes = cachedQuotes.filter((q) => q.accountType === 'PLATFORM_WHOLESALE');
        const bestDirect = directQuotes[0];
        const bestWholesale = wholesaleQuotes[0];
        let savings = 0;
        if (bestDirect && bestWholesale && bestWholesale.totalCostCents < bestDirect.totalCostCents) {
          savings = bestDirect.totalCostCents - bestWholesale.totalCostCents;
        }

        return {
          quotes: cachedQuotes,
          failedCarrierCount: 0,
          totalTimeMs: Date.now() - startTime,
          fromCache: true,
          bestDirectQuote: bestDirect,
          bestWholesaleQuote: bestWholesale,
          wholesaleSavingsCents: savings,
        };
      }
    }

    const ratePromises: Promise<CarrierQuoteResult>[] = [];

    // Helper to execute carrier adapter through circuit breaker
    const executeWithBreaker = (adapter: ICarrierRatingAdapter, req: RateRequest) => {
      const breaker = this.CIRCUIT_BREAKERS[adapter.carrierCode] || new CarrierCircuitBreaker(adapter.carrierCode);
      return breaker.execute(() => adapter.rate(req));
    };

    // 1. Dispatch Direct BYOC Carrier Queries (if broker has active credentials)
    for (const cred of activeDirectCredentials) {
      const adapter = this.ADAPTERS[cred.carrierCode];
      if (adapter && cred.isActive) {
        let apiKey = '';
        try {
          apiKey = CredentialVault.decrypt(
            {
              encryptedData: cred.encryptedApiKey,
              iv: cred.iv,
              authTag: cred.authTag,
            },
            cred.tenantId
          );
        } catch {
          apiKey = '';
        }


        const directReq: RateRequest = {
          ...baseRequest,
          accountType: 'DIRECT_BYOC',
          carrierCredentials: {
            accountNumber: cred.accountNumber,
            apiKey,
          },
        };
        ratePromises.push(executeWithBreaker(adapter, directReq));
      }
    }

    // Fallback if no custom BYOC credentials configured: evaluate standard direct tariffs for all carriers
    if (activeDirectCredentials.length === 0) {
      for (const adapter of Object.values(this.ADAPTERS)) {
        const directReq: RateRequest = {
          ...baseRequest,
          accountType: 'DIRECT_BYOC',
        };
        ratePromises.push(executeWithBreaker(adapter, directReq));
      }
    }

    // 2. Dispatch Pre-Negotiated Platform Master Wholesale Tier Queries
    for (const adapter of Object.values(this.ADAPTERS)) {
      const wholesaleReq: RateRequest = {
        ...baseRequest,
        accountType: 'PLATFORM_WHOLESALE',
      };
      ratePromises.push(executeWithBreaker(adapter, wholesaleReq));
    }

    // 3. Execute all rate queries concurrently with timeout protection
    const settledResults = await Promise.allSettled(ratePromises);

    const successfulQuotes: CarrierQuoteResult[] = [];
    let failedCount = 0;

    for (const res of settledResults) {
      if (res.status === 'fulfilled') {
        successfulQuotes.push(res.value);
      } else {
        failedCount++;
      }
    }

    // Sort quotes by total carrier cost ascending
    successfulQuotes.sort((a, b) => a.totalCostCents - b.totalCostCents);

    // Populate SHA-256 Rate Cache if successful
    if (successfulQuotes.length > 0) {
      RateCache.set(cacheKey, successfulQuotes);
    }

    // Identify best direct vs best wholesale quotes
    const directQuotes = successfulQuotes.filter((q) => q.accountType === 'DIRECT_BYOC');
    const wholesaleQuotes = successfulQuotes.filter((q) => q.accountType === 'PLATFORM_WHOLESALE');

    const bestDirectQuote = directQuotes[0];
    const bestWholesaleQuote = wholesaleQuotes[0];

    let wholesaleSavingsCents = 0;
    if (bestDirectQuote && bestWholesaleQuote && bestWholesaleQuote.totalCostCents < bestDirectQuote.totalCostCents) {
      wholesaleSavingsCents = bestDirectQuote.totalCostCents - bestWholesaleQuote.totalCostCents;
    }

    const totalTimeMs = Date.now() - startTime;

    return {
      quotes: successfulQuotes,
      failedCarrierCount: failedCount,
      totalTimeMs,
      fromCache: false,
      bestDirectQuote,
      bestWholesaleQuote,
      wholesaleSavingsCents,
    };
  }

  public static getCircuitBreaker(carrierCode: string): CarrierCircuitBreaker {
    return this.CIRCUIT_BREAKERS[carrierCode];
  }
}
