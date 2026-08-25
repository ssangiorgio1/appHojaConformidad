import type { NextFunction, Request, Response } from 'express';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorMiddleware(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000) {
    res.status(409).json({ error: 'Duplicate record' });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
