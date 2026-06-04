import { z } from 'zod';

export const dataPartsSchema = z.object({
  type: z.enum(['text', 'file', 'image', 'tool-invocation']),
  text: z.string().optional(),
  url: z.string().optional(),
  filename: z.string().optional(),
  mediaType: z.string().optional(),
});

export const metadataSchema = z.object({
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  userId: z.string().optional(),
});