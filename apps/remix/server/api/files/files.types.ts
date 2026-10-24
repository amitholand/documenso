import { DOCUMENT_CONVERSION_MIME_TYPE_DOCX } from '@documenso/lib/constants/document-conversion';
import DocumentDataSchema from '@documenso/prisma/generated/zod/modelSchema/DocumentDataSchema';
import { z } from 'zod';

export const ZUploadPdfRequestSchema = z.object({
  file: z.instanceof(File),
});

export const ZUploadPdfResponseSchema = DocumentDataSchema.pick({
  type: true,
  id: true,
});

export type TUploadPdfRequest = z.infer<typeof ZUploadPdfRequestSchema>;
export type TUploadPdfResponse = z.infer<typeof ZUploadPdfResponseSchema>;

export const ZUploadContentTypeSchema = z.enum(['application/pdf', DOCUMENT_CONVERSION_MIME_TYPE_DOCX]);

export type TUploadContentType = z.infer<typeof ZUploadContentTypeSchema>;

export const ZPresignPdfUploadRequestSchema = z.object({
  fileName: z.string().min(1),
  contentType: ZUploadContentTypeSchema.default('application/pdf'),
});

export const ZPresignPdfUploadResponseSchema = z.object({
  key: z.string(),
  url: z.string(),
});

export type TPresignPdfUploadRequest = z.infer<typeof ZPresignPdfUploadRequestSchema>;
export type TPresignPdfUploadResponse = z.infer<typeof ZPresignPdfUploadResponseSchema>;

export const ZUploadPdfFromKeyRequestSchema = z.object({
  key: z.string().min(1),
  fileName: z.string().min(1),
});

export type TUploadPdfFromKeyRequest = z.infer<typeof ZUploadPdfFromKeyRequestSchema>;

export const ZGetEnvelopeItemFileRequestParamsSchema = z.object({
  envelopeId: z.string().min(1),
  envelopeItemId: z.string().min(1),
});

export type TGetEnvelopeItemFileRequestParams = z.infer<typeof ZGetEnvelopeItemFileRequestParamsSchema>;

export const ZGetEnvelopeItemFileRequestQuerySchema = z.object({
  token: z.string().optional(),
});

export type TGetEnvelopeItemFileRequestQuery = z.infer<typeof ZGetEnvelopeItemFileRequestQuerySchema>;

export const ZGetEnvelopeItemFileTokenRequestParamsSchema = z.object({
  token: z.string().min(1),
  envelopeItemId: z.string().min(1),
});

export type TGetEnvelopeItemFileTokenRequestParams = z.infer<typeof ZGetEnvelopeItemFileTokenRequestParamsSchema>;

export const ZGetEnvelopeItemFileDownloadRequestParamsSchema = z.object({
  envelopeId: z.string().min(1),
  envelopeItemId: z.string().min(1),
  version: z.enum(['signed', 'original', 'pending']).default('signed'),
});

export type TGetEnvelopeItemFileDownloadRequestParams = z.infer<typeof ZGetEnvelopeItemFileDownloadRequestParamsSchema>;

export const ZGetEnvelopeItemFileTokenDownloadRequestParamsSchema = z.object({
  token: z.string().min(1),
  envelopeItemId: z.string().min(1),
  version: z.enum(['signed', 'original']).default('signed'),
});

export type TGetEnvelopeItemFileTokenDownloadRequestParams = z.infer<
  typeof ZGetEnvelopeItemFileTokenDownloadRequestParamsSchema
>;
