import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import type { ProcessingJobType, ProcessingState } from "@/shared/enums";

type CreateJobInput = {
  ownerId: string;
  entryId?: string;
  fileId?: string;
  jobType: ProcessingJobType;
  triggeredBy?: string;
  payload?: Record<string, unknown>;
  state?: ProcessingState;
};

function toNullableJson(
  value?: Record<string, unknown>
): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value as Prisma.InputJsonValue;
}

function serializeJob(job: {
  id: string;
  ownerId: string;
  entryId: string | null;
  fileId: string | null;
  jobType: string;
  state: string;
  attempts: number;
  maxAttempts: number;
  triggeredBy: string | null;
  payload: unknown;
  result: unknown;
  errorMessage: string | null;
  queuedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: job.id,
    ownerId: job.ownerId,
    entryId: job.entryId,
    fileId: job.fileId,
    jobType: job.jobType,
    state: job.state,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    triggeredBy: job.triggeredBy,
    payload: job.payload,
    result: job.result,
    errorMessage: job.errorMessage,
    queuedAt: job.queuedAt?.toISOString() ?? null,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString()
  };
}

export const jobsService = {
  async createJob(input: CreateJobInput) {
    const job = await prisma.processingJob.create({
      data: {
        ownerId: input.ownerId,
        entryId: input.entryId ?? null,
        fileId: input.fileId ?? null,
        jobType: input.jobType,
        state: input.state ?? "queued",
        triggeredBy: input.triggeredBy ?? null,
        payload: toNullableJson(input.payload),
        queuedAt: new Date()
      }
    });

    return serializeJob(job);
  },

  async markRunning(jobId: string) {
    const job = await prisma.processingJob.update({
      where: {
        id: jobId
      },
      data: {
        state: "running",
        attempts: {
          increment: 1
        },
        startedAt: new Date(),
        errorMessage: null
      }
    });

    return serializeJob(job);
  },

  async markCompleted(jobId: string, result?: Record<string, unknown>) {
    const job = await prisma.processingJob.update({
      where: {
        id: jobId
      },
      data: {
        state: "completed",
        result: toNullableJson(result),
        completedAt: new Date(),
        errorMessage: null
      }
    });

    return serializeJob(job);
  },

  async markFailed(jobId: string, errorMessage: string, result?: Record<string, unknown>) {
    const job = await prisma.processingJob.update({
      where: {
        id: jobId
      },
      data: {
        state: "failed",
        errorMessage,
        result: toNullableJson(result),
        completedAt: new Date()
      }
    });

    return serializeJob(job);
  },

  async getLatestEntryJob(ownerId: string, entryId: string) {
    const job = await prisma.processingJob.findFirst({
      where: {
        ownerId,
        entryId
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return job ? serializeJob(job) : null;
  }
};
