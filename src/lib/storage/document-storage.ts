import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface StoredDocumentMetadata {
  id: string;
  tenantId: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256Hash: string;
  storagePath: string;
  uploadedAt: Date;
}

export interface IDocumentStorage {
  saveDocument(
    tenantId: string,
    fileName: string,
    mimeType: string,
    buffer: Buffer
  ): Promise<StoredDocumentMetadata>;

  getDocumentBuffer(storagePath: string): Promise<Buffer>;
  deleteDocument(storagePath: string): Promise<void>;
  calculateSha256(buffer: Buffer): string;
}

export function calculateSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export class LocalStorageAdapter implements IDocumentStorage {
  private baseDir: string;
  private metadataStore: Map<string, StoredDocumentMetadata> = new Map();

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.resolve(process.cwd(), 'storage_vault');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  public calculateSha256(buffer: Buffer): string {
    return calculateSha256(buffer);
  }

  public async saveDocument(
    tenantId: string,
    fileName: string,
    mimeType: string,
    buffer: Buffer
  ): Promise<StoredDocumentMetadata> {
    const hash = this.calculateSha256(buffer);
    const tenantDir = path.join(this.baseDir, tenantId);
    if (!fs.existsSync(tenantDir)) {
      fs.mkdirSync(tenantDir, { recursive: true });
    }

    const ext = path.extname(fileName) || '.bin';
    const safeName = `${hash.substring(0, 16)}_${Date.now()}${ext}`;
    const filePath = path.join(tenantDir, safeName);

    await fs.promises.writeFile(filePath, buffer);

    const metadata: StoredDocumentMetadata = {
      id: crypto.randomUUID(),
      tenantId,
      originalFileName: fileName,
      mimeType,
      sizeBytes: buffer.length,
      sha256Hash: hash,
      storagePath: filePath,
      uploadedAt: new Date(),
    };

    this.metadataStore.set(metadata.id, metadata);
    return metadata;
  }

  public async getDocumentBuffer(storagePath: string): Promise<Buffer> {
    if (!fs.existsSync(storagePath)) {
      throw new Error(`File not found at storage path: ${storagePath}`);
    }
    return fs.promises.readFile(storagePath);
  }

  public async deleteDocument(storagePath: string): Promise<void> {
    if (fs.existsSync(storagePath)) {
      await fs.promises.unlink(storagePath);
    }
  }
}

// S3-Compatible Storage Adapter Implementation
export class S3StorageAdapter implements IDocumentStorage {
  private bucket: string;
  private endpoint: string;

  constructor(bucket: string, endpoint: string) {
    this.bucket = bucket;
    this.endpoint = endpoint;
  }

  public calculateSha256(buffer: Buffer): string {
    return calculateSha256(buffer);
  }

  public async saveDocument(
    tenantId: string,
    fileName: string,
    mimeType: string,
    buffer: Buffer
  ): Promise<StoredDocumentMetadata> {
    const hash = this.calculateSha256(buffer);
    const s3Key = `${tenantId}/${hash}/${fileName}`;

    const metadata: StoredDocumentMetadata = {
      id: crypto.randomUUID(),
      tenantId,
      originalFileName: fileName,
      mimeType,
      sizeBytes: buffer.length,
      sha256Hash: hash,
      storagePath: `s3://${this.bucket}/${s3Key}`,
      uploadedAt: new Date(),
    };

    return metadata;
  }

  public async getDocumentBuffer(storagePath: string): Promise<Buffer> {
    return Buffer.from(`Mock S3 payload for ${storagePath}`);
  }

  public async deleteDocument(_storagePath: string): Promise<void> {
    // S3 Delete Simulation
  }
}

// Factory Helper
export function getDocumentStorage(): IDocumentStorage {
  if (process.env.STORAGE_PROVIDER === 's3' && process.env.S3_BUCKET) {
    return new S3StorageAdapter(process.env.S3_BUCKET, process.env.S3_ENDPOINT || 'https://s3.amazonaws.com');
  }
  return new LocalStorageAdapter();
}
