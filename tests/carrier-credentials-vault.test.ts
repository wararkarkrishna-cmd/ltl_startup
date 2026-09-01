import { describe, it, expect } from 'vitest';
import { CredentialVault } from '../src/lib/security/credential-vault';

describe('Phase 2.1: Carrier Credentials Vault (AES-256-GCM)', () => {
  const testTenant1 = '01916362-7901-7080-867c-9b8895092a01';
  const testTenant2 = '01916362-7901-7080-867c-9b8895092a02';

  it('successfully encrypts and decrypts sensitive carrier credentials using AES-256-GCM', () => {
    const rawApiKey = 'XPO_PROD_API_KEY_SEC_98492048';
    const encrypted = CredentialVault.encrypt(rawApiKey, testTenant1);

    expect(encrypted.encryptedData).toBeDefined();
    expect(encrypted.encryptedData).not.toBe(rawApiKey);
    expect(encrypted.iv).toHaveLength(32); // 16 bytes hex
    expect(encrypted.authTag).toHaveLength(32); // 16 bytes hex

    const decrypted = CredentialVault.decrypt(encrypted, testTenant1);
    expect(decrypted).toBe(rawApiKey);
  });

  it('strictly isolates tenant encryption keys preventing cross-tenant decryption', () => {
    const rawSecret = 'SAIA_TOP_SECRET_PASSWORD_123';
    const encrypted = CredentialVault.encrypt(rawSecret, testTenant1);

    // Attempting to decrypt with a different tenantId must fail due to AAD / Key mismatch
    expect(() => {
      CredentialVault.decrypt(encrypted, testTenant2);
    }).toThrow();
  });

  it('detects and rejects tampered ciphertext or modified authentication tags', () => {
    const rawApiKey = 'ESTES_SECURE_TOKEN_554433';
    const encrypted = CredentialVault.encrypt(rawApiKey, testTenant1);

    // Tamper ciphertext
    const tamperedData = (encrypted.encryptedData[0] === '0' ? '1' : '0') + encrypted.encryptedData.slice(1);
    expect(() => {
      CredentialVault.decrypt(
        {
          encryptedData: tamperedData,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
        },
        testTenant1
      );
    }).toThrow();

    // Tamper auth tag
    const tamperedTag = (encrypted.authTag[0] === '0' ? '1' : '0') + encrypted.authTag.slice(1);
    expect(() => {
      CredentialVault.decrypt(
        {
          encryptedData: encrypted.encryptedData,
          iv: encrypted.iv,
          authTag: tamperedTag,
        },
        testTenant1
      );
    }).toThrow();
  });

  it('throws error when encrypting empty strings or missing tenant ID', () => {
    expect(() => CredentialVault.encrypt('', testTenant1)).toThrow();
    expect(() => CredentialVault.encrypt('valid-secret', '')).toThrow();
  });
});
