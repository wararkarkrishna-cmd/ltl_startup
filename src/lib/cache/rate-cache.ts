import * as crypto from 'crypto';
import { RateRequest, CarrierQuoteResult } from '../rating/carrier-adapter.interface';

export interface CachedRateEntry {
  quotes: CarrierQuoteResult[];
  cachedAt: number;
  expiresAt: number;
}

export class RateCache {
  private static readonly DEFAULT_TTL_MS = 900 * 1000; // 900 seconds (15 minutes)
  private static cache: Map<string, CachedRateEntry> = new Map();

  public static stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0,
  };

  /**
   * Compute deterministic SHA-256 cache key
   * key = rate:sha256(origin_zip:dest_zip:weight:class:accessorials:tenant_id)
   */
  public static generateCacheKey(request: Omit<RateRequest, 'accountType'>): string {
    const totalWeight = request.items.reduce((s, it) => s + (it.weightLbs || 500) * (it.quantity || 1), 0);
    const classes = request.items.map((it) => it.nmfcClass).sort().join(',');
    const sortedAccessorials = [...(request.accessorials || [])].sort().join(',');

    const rawPayload = `${request.originZip.trim()}:${request.destZip.trim()}:${totalWeight}:${classes}:${sortedAccessorials}:${request.tenantId}`;
    const hash = crypto.createHash('sha256').update(rawPayload, 'utf8').digest('hex');
    return `rate:${hash}`;
  }

  public static get(key: string): CarrierQuoteResult[] | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check TTL expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.evictions++;
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.quotes;
  }

  public static set(key: string, quotes: CarrierQuoteResult[], ttlMs: number = this.DEFAULT_TTL_MS): void {
    const now = Date.now();
    this.cache.set(key, {
      quotes,
      cachedAt: now,
      expiresAt: now + ttlMs,
    });
    this.stats.sets++;
  }

  public static clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, sets: 0, evictions: 0 };
  }

  public static size(): number {
    return this.cache.size;
  }
}
