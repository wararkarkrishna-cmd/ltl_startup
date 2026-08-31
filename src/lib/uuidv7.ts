import crypto from 'crypto';

/**
 * UUIDv7 Monotonic Time-Ordered Unique Identifier Generator (RFC 9562)
 * Layout:
 * 48 bits: Unix timestamp in milliseconds
 * 4 bits: Version (0111 = 7)
 * 12 bits: Counter / random sequence
 * 2 bits: Variant (10 = RFC 4122/9562)
 * 62 bits: Cryptographic pseudo-random bits
 */
let lastTimestamp = -1;
let seqCounter = 0;

export function generateUuidV7(): string {
  let timestamp = Date.now();
  
  if (timestamp <= lastTimestamp) {
    seqCounter = (seqCounter + 1) & 0xfff;
    if (seqCounter === 0) {
      // Counter overflowed within same millisecond, increment simulated timestamp
      timestamp = lastTimestamp + 1;
    }
  } else {
    seqCounter = crypto.randomInt(0, 0x1000);
    lastTimestamp = timestamp;
  }

  const bytes = Buffer.alloc(16);

  // 48-bit timestamp (big-endian)
  bytes.writeUIntBE(timestamp, 0, 6);

  // 4-bit version (0x7) + 12-bit sequence counter
  const verAndSeq = 0x7000 | (seqCounter & 0x0fff);
  bytes.writeUInt16BE(verAndSeq, 6);

  // 2-bit variant (0x80) + 62 bits random data
  const randomBytes = crypto.randomBytes(8);
  randomBytes.copy(bytes, 8);
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  // Format as standard UUID string: 8-4-4-4-12
  const hex = bytes.toString('hex');
  return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}`;
}

export function getTimestampFromUuidV7(uuid: string): Date {
  const cleanHex = uuid.replace(/-/g, '');
  if (cleanHex.length !== 32) {
    throw new Error(`Invalid UUID string: ${uuid}`);
  }
  const timestampHex = cleanHex.substring(0, 12);
  const timestampMs = parseInt(timestampHex, 16);
  return new Date(timestampMs);
}

export function isValidUuidV7(uuid: string): boolean {
  const uuidV7Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV7Regex.test(uuid);
}
