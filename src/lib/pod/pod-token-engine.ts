import crypto from 'crypto';
import { z } from 'zod';
import { PodToken, PodTokenSchema } from '../../db/schema';
import { dbClient } from '../../db/client';

export const PodTokenGenerationParamsSchema = z.object({
  tenantId: z.string().uuid(),
  shipmentId: z.string().uuid(),
  carrierCode: z.string().optional().nullable(),
  driverPhone: z.string().optional().nullable(),
  expiresInHours: z.number().positive().default(72), // Default 3 days expiration
});

export type PodTokenGenerationParams = z.infer<typeof PodTokenGenerationParamsSchema>;

export const PodTokenValidationResultSchema = z.object({
  isValid: z.boolean(),
  podToken: PodTokenSchema.optional().nullable(),
  error: z.string().optional().nullable(),
  isExpired: z.boolean().default(false),
  isConsumed: z.boolean().default(false),
});

export type PodTokenValidationResult = z.infer<typeof PodTokenValidationResultSchema>;

/**
 * Enterprise Cryptographic POD Action Token Engine
 * Manages one-time, tamper-proof mobile upload tokens for truck drivers.
 */
export class PodTokenEngine {
  public static readonly TOKEN_PREFIX = 'pod_sec_';

  /**
   * Generate a secure crypto-random token for driver upload portal
   */
  public static async generatePodToken(
    params: {
      tenantId: string;
      shipmentId: string;
      carrierCode?: string | null;
      driverPhone?: string | null;
      expiresInHours?: number;
    }
  ): Promise<PodToken> {
    const validated = PodTokenGenerationParamsSchema.parse(params);
    
    // Generate 32 bytes of cryptographic randomness (64 hex characters)
    const randomHex = crypto.randomBytes(32).toString('hex');
    const token = `${this.TOKEN_PREFIX}${randomHex}`;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + (validated.expiresInHours || 72) * 60 * 60 * 1000);

    const podTokenRecord: PodToken = {
      token,
      tenantId: validated.tenantId,
      shipmentId: validated.shipmentId,
      carrierCode: validated.carrierCode || null,
      driverPhone: validated.driverPhone || null,
      expiresAt,
      isUsed: false,
      usedAt: null,
      createdAt: now,
    };

    await dbClient.insertPodToken(podTokenRecord);
    return podTokenRecord;
  }

  /**
   * Validate and optionally consume a POD Action Token
   */
  public static async validateAndConsumePodToken(
    tokenString: string,
    markConsumed = false
  ): Promise<PodTokenValidationResult> {
    if (!tokenString || typeof tokenString !== 'string' || !tokenString.trim()) {
      return {
        isValid: false,
        podToken: null,
        error: 'POD token is required',
        isExpired: false,
        isConsumed: false,
      };
    }

    const cleanToken = tokenString.trim();
    const tokenRecord = await dbClient.getPodToken(cleanToken);

    if (!tokenRecord) {
      return {
        isValid: false,
        podToken: null,
        error: 'Invalid or non-existent POD access token',
        isExpired: false,
        isConsumed: false,
      };
    }

    const now = new Date();
    const isExpired = new Date(tokenRecord.expiresAt).getTime() < now.getTime();
    if (isExpired) {
      return {
        isValid: false,
        podToken: tokenRecord,
        error: `POD token expired on ${new Date(tokenRecord.expiresAt).toISOString()}`,
        isExpired: true,
        isConsumed: tokenRecord.isUsed,
      };
    }

    if (tokenRecord.isUsed) {
      return {
        isValid: false,
        podToken: tokenRecord,
        error: `POD token was already used and consumed on ${tokenRecord.usedAt ? new Date(tokenRecord.usedAt).toISOString() : 'earlier date'}`,
        isExpired: false,
        isConsumed: true,
      };
    }

    if (markConsumed) {
      const consumedRecord = await dbClient.markPodTokenUsed(cleanToken);
      return {
        isValid: true,
        podToken: consumedRecord || tokenRecord,
        error: null,
        isExpired: false,
        isConsumed: true,
      };
    }

    return {
      isValid: true,
      podToken: tokenRecord,
      error: null,
      isExpired: false,
      isConsumed: false,
    };
  }

  /**
   * Retrieve a POD token by string
   */
  public static async getPodToken(tokenString: string): Promise<PodToken | null> {
    if (!tokenString) return null;
    return dbClient.getPodToken(tokenString.trim());
  }

  /**
   * Build complete Driver Mobile Portal URL
   */
  public static buildDriverPortalUrl(baseUrl: string, tokenString: string): string {
    const cleanBase = (baseUrl || 'https://app.apexltl.com').replace(/\/$/, '');
    return `${cleanBase}/pod/${encodeURIComponent(tokenString)}`;
  }
}
