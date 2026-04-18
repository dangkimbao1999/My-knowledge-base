import { NextResponse } from "next/server";
import { ZodSchema } from "zod";

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function parseJson<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<T> {
  const body = await request.json();
  return schema.parse(body);
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(
    {
      success: true,
      data
    },
    init
  );
}

export function accepted<T>(data: T) {
  return ok(data, { status: 202 });
}

export function created<T>(data: T) {
  return ok(data, { status: 201 });
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        details
      }
    },
    { status }
  );
}

export async function routeHandler<T>(
  handler: () => Promise<T | Response>,
  options?: { status?: number }
) {
  try {
    const data = await handler();

    if (data instanceof Response) {
      return data;
    }

    return ok(data, { status: options?.status ?? 200 });
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.message, error.status, error.details);
    }

    if (error instanceof Error) {
      return fail(error.message, 400);
    }

    return fail("Unexpected server error", 500);
  }
}
