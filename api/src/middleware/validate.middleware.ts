import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

type Target = 'body' | 'query' | 'params';

export function validate(schema: ZodType, target: Target = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
      return;
    }
    req[target] = result.data;
    next();
  };
}
