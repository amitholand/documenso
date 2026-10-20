import { z } from 'zod';

export const ZRecordSigningConsentRequestSchema = z.object({
  token: z.string(),
  locale: z.string().max(16),
  stamp: z
    .object({
      companyName: z.string().trim().min(1).max(255),
      companyNumber: z.string().trim().min(1).max(64),
      role: z.string().trim().min(1).max(255),
    })
    .optional(),
});

export const ZRecordSigningConsentResponseSchema = z.void();

export type TRecordSigningConsentRequest = z.infer<typeof ZRecordSigningConsentRequestSchema>;
