import { NextRequest, NextResponse } from 'next/server';
import { rfqIngestionQueue } from '@/lib/queue/ingestion-queue';

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const { jobId } = params;
  const job = rfqIngestionQueue.getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json({
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    attempts: job.attempts,
    result: job.result || null,
    error: job.error || null,
    createdAt: job.createdAt,
    completedAt: job.completedAt || null,
  });
}
