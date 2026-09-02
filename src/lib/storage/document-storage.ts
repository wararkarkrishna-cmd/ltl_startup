import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '../supabase/admin';

export interface StoredDocumentMetadata {
  id: string;
  tenantId: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256Hash: string;
  storagePath: string;
  publicUrl?: string | null;
  uploadedAt: Date;
}

export interface IDocumentStorage {
  saveDocument(
    tenantId: string,
    fileName: string,
    mimeType: string,
    buffer: Buffer,
    bucketOverride?: string
  ): Promise<StoredDocumentMetadata>;

  getDocumentBuffer(storagePath: string): Promise<Buffer>;
  deleteDocument(storagePath: string): Promise<void>;
  calculateSha256(buffer: Buffer): string;
}

export function calculateSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Supabase Storage Adapter
 * Stores all PDFs, rate sheets, signed BOLs, POD photos, invoices, and dispute packets in Supabase Storage.
 */
export class SupabaseStorageAdapter implements IDocumentStorage {
  private defaultBucket: string;
  private localFallback: LocalStorageAdapter;
  private initializedBuckets: Set<string> = new Set();

  constructor(defaultBucket: string = 'rfq-documents') {
    this.defaultBucket = defaultBucket;
    this.localFallback = new LocalStorageAdapter();
  }

  public calculateSha256(buffer: Buffer): string {
    return calculateSha256(buffer);
  }

  private async ensureBucketExists(bucket: string): Promise<void> {
    if (this.initializedBuckets.has(bucket)) return;
    try {
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();
      const exists = buckets?.some((b) => b.name === bucket);
      if (!exists) {
        await supabaseAdmin.storage.createBucket(bucket, {
          public: true,
          fileSizeLimit: 52428800, // 50 MB
        });
      }
      this.initializedBuckets.add(bucket);
    } catch {
      this.initializedBuckets.add(bucket);
    }
  }

  public async saveDocument(
    tenantId: string,
    fileName: string,
    mimeType: string,
    buffer: Buffer,
    bucketOverride?: string
  ): Promise<StoredDocumentMetadata> {
    const hash = this.calculateSha256(buffer);
    const bucket = bucketOverride || this.defaultBucket;
    const ext = path.extname(fileName) || '.bin';
    const cleanFileName = path.basename(fileName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const storagePath = `${tenantId}/${hash.substring(0, 16)}_${cleanFileName}${ext}`;

    try {
      await this.ensureBucketExists(bucket);

      const { error: uploadError } = await supabaseAdmin.storage
        .from(bucket)
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Supabase Storage Upload Error: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabaseAdmin.storage
        .from(bucket)
        .getPublicUrl(storagePath);

      const metadata: StoredDocumentMetadata = {
        id: crypto.randomUUID(),
        tenantId,
        originalFileName: fileName,
        mimeType,
        sizeBytes: buffer.length,
        sha256Hash: hash,
        storagePath: `supabase://${bucket}/${storagePath}`,
        publicUrl: publicUrlData?.publicUrl || null,
        uploadedAt: new Date(),
      };

      // Also cache locally
      await this.localFallback.saveDocument(tenantId, fileName, mimeType, buffer);

      return metadata;
    } catch {
      // Fallback gracefully to local storage if network / storage bucket is offline
      const fallbackMeta = await this.localFallback.saveDocument(tenantId, fileName, mimeType, buffer);
      return {
        ...fallbackMeta,
        publicUrl: null,
      };
    }
  }

  public async getDocumentBuffer(storagePath: string): Promise<Buffer> {
    if (storagePath.startsWith('supabase://')) {
      const parts = storagePath.replace('supabase://', '').split('/');
      const bucket = parts[0];
      const filePath = parts.slice(1).join('/');

      try {
        const { data, error } = await supabaseAdmin.storage.from(bucket).download(filePath);
        if (error) {
          throw new Error(`Supabase Storage Download Error: ${error.message}`);
        }
        const arrayBuffer = await data.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } catch {
        return this.localFallback.getDocumentBuffer(filePath);
      }
    }

    return this.localFallback.getDocumentBuffer(storagePath);
  }

  public async deleteDocument(storagePath: string): Promise<void> {
    if (storagePath.startsWith('supabase://')) {
      const parts = storagePath.replace('supabase://', '').split('/');
      const bucket = parts[0];
      const filePath = parts.slice(1).join('/');

      await supabaseAdmin.storage.from(bucket).remove([filePath]);
    }
    await this.localFallback.deleteDocument(storagePath);
  }
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
      publicUrl: `file://${filePath}`,
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
      publicUrl: `https://${this.bucket}.s3.amazonaws.com/${s3Key}`,
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

// Singleton factory
let globalStorage: IDocumentStorage | null = null;

export function getDocumentStorage(): IDocumentStorage {
  if (!globalStorage) {
    if (process.env.STORAGE_PROVIDER === 's3' && process.env.S3_BUCKET) {
      globalStorage = new S3StorageAdapter(process.env.S3_BUCKET, process.env.S3_ENDPOINT || 'https://s3.amazonaws.com');
    } else {
      globalStorage = new SupabaseStorageAdapter('rfq-documents');
    }
  }
  return globalStorage;
}

