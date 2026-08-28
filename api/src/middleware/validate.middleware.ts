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
    // Express 5 makes `req.query` a getter-only accessor (parsed lazily from
    // `req.url`), so a plain assignment throws — redefine the property
    // instead. `req.body`/`req.params` are plain writable properties, but
    // defineProperty works for those the same way.
    Object.defineProperty(req, target, {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    next();
  };
}
