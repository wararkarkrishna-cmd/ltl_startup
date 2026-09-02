/**
 * Universal (Browser + Node.js) UUIDv7 Monotonic Time-Ordered Unique Identifier Generator (RFC 9562)
 * Layout:
 * 48 bits: Unix timestamp in milliseconds
 * 4 bits: Version (0111 = 7)
 * 12 bits: Counter / sequence
 * 2 bits: Variant (10 = RFC 4122/9562)
 * 62 bits: Pseudo-random bits
 */
let lastTimestamp = -1;
let seqCounter = 0;

function getRandom12BitInt(): number {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    const arr = new Uint16Array(1);
    globalThis.crypto.getRandomValues(arr);
    return arr[0] & 0x0fff;
  }
  return Math.floor(Math.random() * 0x1000);
}

function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytes;
}

export function generateUuidV7(): string {
  let timestamp = Date.now();

  if (timestamp <= lastTimestamp) {
    seqCounter = (seqCounter + 1) & 0x0fff;
    if (seqCounter === 0) {
      // Counter overflowed within same millisecond, increment simulated timestamp
      timestamp = lastTimestamp + 1;
    }
  } else {
    seqCounter = getRandom12BitInt();
    lastTimestamp = timestamp;
  }

  const bytes = new Uint8Array(16);

  // 48-bit timestamp (big-endian)
  bytes[0] = (timestamp / 0x10000000000) & 0xff;
  bytes[1] = (timestamp / 0x100000000) & 0xff;
  bytes[2] = (timestamp / 0x1000000) & 0xff;
  bytes[3] = (timestamp / 0x10000) & 0xff;
  bytes[4] = (timestamp / 0x100) & 0xff;
  bytes[5] = timestamp & 0xff;

  // 4-bit version (0x7) + 12-bit sequence counter
  bytes[6] = 0x70 | ((seqCounter >> 8) & 0x0f);
  bytes[7] = seqCounter & 0xff;

  // 2-bit variant (0x80) + random bytes
  const rand = getRandomBytes(8);
  bytes[8] = (rand[0] & 0x3f) | 0x80;
  bytes[9] = rand[1];
  bytes[10] = rand[2];
  bytes[11] = rand[3];
  bytes[12] = rand[4];
  bytes[13] = rand[5];
  bytes[14] = rand[6];
  bytes[15] = rand[7];

  // Convert to standard UUID string: 8-4-4-4-12
  let hex = '';
  for (let i = 0; i < 16; i++) {
    const h = bytes[i].toString(16).padStart(2, '0');
    hex += h;
  }

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
