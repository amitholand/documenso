import { z } from 'zod';

export const ZStampDeclarationSchema = z.object({
  companyName: z.string().trim().min(1).max(255),
  companyNumber: z.string().trim().min(1).max(64),
  role: z.string().trim().min(1).max(255),
});

/**
 * The consent a signer approved in the signing dialog, sent along when the server
 * cannot record it beforehand (e.g. direct templates create the recipient on completion).
 */
export const ZSigningConsentInputSchema = z.object({
  locale: z.string().max(16),
  stamp: ZStampDeclarationSchema.optional(),
});

export type TSigningConsentInput = z.infer<typeof ZSigningConsentInputSchema>;
