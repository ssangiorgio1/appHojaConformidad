import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { presignedUrlSchema } from '../schemas/upload.schema.js';
import { createPresignedUrl } from '../controllers/uploads.controller.js';

export const uploadsRouter = Router();

uploadsRouter.post('/presigned-url', requireAuth, validate(presignedUrlSchema), createPresignedUrl);
