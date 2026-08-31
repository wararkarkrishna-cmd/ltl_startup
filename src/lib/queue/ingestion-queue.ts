import { EventEmitter } from 'events';
import { generateUuidV7 } from '../uuidv7';

export type JobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface IngestionJobData {
  tenantId: string;
  documentId?: string;
  sourceChannel: 'UPLOAD' | 'EMAIL_WEBHOOK' | 'RAW_TEXT' | 'API';
  fileName: string;
  mimeType: string;
  rawBuffer?: Buffer;
  rawText?: string;
  metadata?: Record<string, any>;
}

export interface IngestionJobResult {
  jobId: string;
  status: JobStatus;
  progress: number;
  attempts: number;
  maxAttempts: number;
  data: IngestionJobData;
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export type JobProcessor = (job: IngestionJobResult) => Promise<any>;

export class IngestionTaskQueue extends EventEmitter {
  private jobs: Map<string, IngestionJobResult> = new Map();
  private processor: JobProcessor | null = null;
  private maxAttempts: number = 3;
  private concurrency: number = 5;
  private activeCount: number = 0;

  constructor(maxAttempts: number = 3, concurrency: number = 5) {
    super();
    this.maxAttempts = maxAttempts;
    this.concurrency = concurrency;
  }

  public registerProcessor(processor: JobProcessor): void {
    this.processor = processor;
  }

  public async addJob(data: IngestionJobData): Promise<IngestionJobResult> {
    const jobId = generateUuidV7();
    const now = new Date();

    const job: IngestionJobResult = {
      jobId,
      status: 'QUEUED',
      progress: 0,
      attempts: 0,
      maxAttempts: this.maxAttempts,
      data,
      createdAt: now,
      updatedAt: now,
    };

    this.jobs.set(jobId, job);
    this.emit('jobAdded', job);
    
    setImmediate(() => this.processNext());

    return job;
  }

  public getJob(jobId: string): IngestionJobResult | null {
    return this.jobs.get(jobId) || null;
  }

  public updateJobProgress(jobId: string, progress: number): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.progress = Math.min(100, Math.max(0, progress));
      job.updatedAt = new Date();
      this.emit('progress', job);
    }
  }

  private async processNext(): Promise<void> {
    if (this.activeCount >= this.concurrency || !this.processor) {
      return;
    }

    let nextJob: IngestionJobResult | null = null;
    for (const job of this.jobs.values()) {
      if (job.status === 'QUEUED') {
        nextJob = job;
        break;
      }
    }

    if (!nextJob) {
      return;
    }

    this.activeCount++;
    nextJob.status = 'PROCESSING';
    nextJob.attempts += 1;
    nextJob.updatedAt = new Date();
    this.emit('jobStarted', nextJob);

    try {
      const result = await this.processor(nextJob);
      nextJob.status = 'COMPLETED';
      nextJob.progress = 100;
      nextJob.result = result;
      nextJob.completedAt = new Date();
      nextJob.updatedAt = new Date();
      this.emit('jobCompleted', nextJob);
    } catch (err: any) {
      console.error(`[Queue] Job ${nextJob.jobId} failed attempt ${nextJob.attempts}/${nextJob.maxAttempts}:`, err);
      
      if (nextJob.attempts < nextJob.maxAttempts) {
        const backoffMs = Math.pow(2, nextJob.attempts - 1) * 1000;
        nextJob.status = 'QUEUED';
        nextJob.error = err.message || String(err);
        nextJob.updatedAt = new Date();
        this.emit('jobRetry', { job: nextJob, backoffMs });

        setTimeout(() => {
          this.processNext();
        }, backoffMs);
      } else {
        nextJob.status = 'FAILED';
        nextJob.error = err.message || String(err);
        nextJob.updatedAt = new Date();
        this.emit('jobFailed', nextJob);
      }
    } finally {
      this.activeCount--;
      setImmediate(() => this.processNext());
    }
  }
}

export const rfqIngestionQueue = new IngestionTaskQueue(3, 5);
