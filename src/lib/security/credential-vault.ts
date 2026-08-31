import * as crypto from 'crypto';

/**
 * AES-256-GCM Credential Encryption & Decryption Engine
 * Implements tenant-isolated key derivation and 128-bit authentication tag verification.
 */
export interface EncryptedPayload {
  encryptedData: string; // Hex-encoded ciphertext
  iv: string;            // 16 bytes Hex-encoded Initialization Vector
  authTag: string;       // 16 bytes Hex-encoded GCM Authentication Tag
}

export class CredentialVault {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 16; // 128-bit IV
  private static readonly AUTH_TAG_LENGTH = 16; // 128-bit Auth Tag
  private static readonly DEFAULT_SYSTEM_SECRET =
    process.env.CARRIER_VAULT_MASTER_KEY || 'ltl-carrier-vault-super-secure-master-key-2026-production';

  /**
   * Derive a tenant-isolated 256-bit encryption key using PBKDF2
   */
  private static deriveTenantKey(tenantId: string, masterSecret?: string): Buffer {
    const secret = masterSecret || this.DEFAULT_SYSTEM_SECRET;
    const salt = Buffer.from(`ltl-os-tenant-salt:${tenantId}`, 'utf8');
    return crypto.pbkdf2Sync(secret, salt, 100_000, 32, 'sha256');
  }

  /**
   * Encrypt sensitive string (API Key, Account Password, Client Secret) using AES-256-GCM
   */
  public static encrypt(
    plainText: string,
    tenantId: string,
    masterSecret?: string
  ): EncryptedPayload {
    if (!plainText) {
      throw new Error('Cannot encrypt empty credential text');
    }
    if (!tenantId) {
      throw new Error('Tenant ID is required for tenant-isolated credential encryption');
    }

    const key = this.deriveTenantKey(tenantId, masterSecret);
    const iv = crypto.randomBytes(this.IV_LENGTH);

    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv, {
      authTagLength: this.AUTH_TAG_LENGTH,
    });

    // Additional Authenticated Data (AAD) binds ciphertext to specific tenant
    cipher.setAAD(Buffer.from(tenantId, 'utf8'));

    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      authTag,
    };
  }

  /**
   * Decrypt sensitive string verifying 128-bit GCM Auth Tag and Tenant Context
   */
  public static decrypt(
    payload: EncryptedPayload,
    tenantId: string,
    masterSecret?: string
  ): string {
    if (!payload || !payload.encryptedData || !payload.iv || !payload.authTag) {
      throw new Error('Invalid encrypted payload: missing ciphertext, IV, or Auth Tag');
    }
    if (!tenantId) {
      throw new Error('Tenant ID is required for credential decryption');
    }

    const key = this.deriveTenantKey(tenantId, masterSecret);
    const ivBuffer = Buffer.from(payload.iv, 'hex');
    const authTagBuffer = Buffer.from(payload.authTag, 'hex');

    if (ivBuffer.length !== this.IV_LENGTH) {
      throw new Error(`Invalid IV length: expected ${this.IV_LENGTH} bytes`);
    }
    if (authTagBuffer.length !== this.AUTH_TAG_LENGTH) {
      throw new Error(`Invalid Auth Tag length: expected ${this.AUTH_TAG_LENGTH} bytes`);
    }

    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, ivBuffer, {
      authTagLength: this.AUTH_TAG_LENGTH,
    });

    decipher.setAAD(Buffer.from(tenantId, 'utf8'));
    decipher.setAuthTag(authTagBuffer);

    let decrypted = decipher.update(payload.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
