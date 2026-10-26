import { ZSigningConsentInputSchema } from '@documenso/lib/types/signing-consent';
import { z } from 'zod';

export const ZRecordSigningConsentRequestSchema = ZSigningConsentInputSchema.extend({
  token: z.string(),
});

export const ZRecordSigningConsentResponseSchema = z.void();

export type TRecordSigningConsentRequest = z.infer<typeof ZRecordSigningConsentRequestSchema>;
