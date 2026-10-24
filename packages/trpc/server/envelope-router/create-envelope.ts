import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { convertToPdf } from '@documenso/lib/server-only/document-conversion';
import { createEnvelope } from '@documenso/lib/server-only/envelope/create-envelope';
import { extractPdfPlaceholders } from '@documenso/lib/server-only/pdf/auto-place-fields';
import { normalizePdf } from '@documenso/lib/server-only/pdf/normalize-pdf';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { megabytesToBytes } from '@documenso/lib/universal/unit-convertions';
import { getStorageProvider } from '@documenso/lib/universal/upload/providers';
import { putPdfFileServerSide } from '@documenso/lib/universal/upload/put-file.server';
import { EnvelopeType } from '@prisma/client';
import type { Logger } from 'pino';
import { match, P } from 'ts-pattern';

import { insertFormValuesInPdf } from '../../../lib/server-only/pdf/insert-form-values-in-pdf';
import { authenticatedProcedure } from '../trpc';
import type { TCreateEnvelopeRequest } from './create-envelope.types';
import {
  createEnvelopeMeta,
  ZCreateEnvelopeRequestSchema,
  ZCreateEnvelopeResponseSchema,
} from './create-envelope.types';

export const createEnvelopeRoute = authenticatedProcedure
  .meta(createEnvelopeMeta)
  .input(ZCreateEnvelopeRequestSchema)
  .output(ZCreateEnvelopeResponseSchema)
  .mutation(async ({ input, ctx }) => {
    ctx.logger.info({
      input: {
        folderId: input.payload.folderId,
      },
    });

    return await createEnvelopeRouteCaller({
      userId: ctx.user.id,
      teamId: ctx.teamId,
      input,
      apiRequestMetadata: ctx.metadata,
      logger: ctx.logger,
    });
  });

type CreateEnvelopeRouteOptions = {
  /**
   * Verified user ID.
   */
  userId: number;

  /**
   * Unverified team ID.
   */
  teamId: number;
  input: TCreateEnvelopeRequest;
  apiRequestMetadata: ApiRequestMetadata;

  /**
   * Optional pino logger threaded from the calling tRPC context. Passed to
   * downstream helpers (e.g. `convertToPdf`) for structured logging.
   */
  logger?: Logger;

  options?: {
    bypassDefaultRecipients?: boolean;
  };
};

type TemporaryUploadFile = {
  name: string;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

/**
 * Loads a file that the client uploaded straight to object storage. Keys are only accepted
 * when they belong to the requesting user. The key is recorded as soon as the object has been
 * fetched so it gets cleaned up even if the file is later rejected.
 */
const fetchUploadedFile = async ({
  userId,
  fileKey,
  fetchedKeys,
}: {
  userId: number;
  fileKey: { key: string; fileName: string; type: string };
  fetchedKeys: string[];
}): Promise<TemporaryUploadFile> => {
  const { key, fileName, type } = fileKey;

  if (!key.startsWith(`${userId}/`)) {
    throw new AppError(AppErrorCode.FORBIDDEN, {
      message: 'Invalid upload key',
    });
  }

  const { url } = await getStorageProvider().getPresignGetUrl(key);

  const response = await fetch(url);

  if (!response.ok) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Uploaded file not found',
    });
  }

  const buffer = await response.arrayBuffer();

  fetchedKeys.push(key);

  if (buffer.byteLength > megabytesToBytes(APP_DOCUMENT_UPLOAD_SIZE_LIMIT)) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: `File cannot be larger than ${APP_DOCUMENT_UPLOAD_SIZE_LIMIT}MB`,
    });
  }

  return {
    name: fileName,
    type,
    arrayBuffer: async () => buffer,
  };
};

/**
 * Fetches all uploaded files. Every fetch settles before any error is thrown so that
 * `fetchedKeys` is complete when the caller cleans up.
 */
const fetchUploadedFiles = async ({
  userId,
  fileKeys,
  fetchedKeys,
}: {
  userId: number;
  fileKeys: { key: string; fileName: string; type: string }[];
  fetchedKeys: string[];
}): Promise<TemporaryUploadFile[]> => {
  const results = await Promise.allSettled(
    fileKeys.map(async (fileKey) => fetchUploadedFile({ userId, fileKey, fetchedKeys })),
  );

  return results.map((result) => {
    if (result.status === 'rejected') {
      throw result.reason;
    }

    return result.value;
  });
};

const deleteTemporaryUploads = async (keys: string[]) => {
  const storage = getStorageProvider();

  await Promise.all(
    keys.map(async (key) =>
      storage.deleteFile(key).catch((error) => {
        console.error('Failed to delete temporary upload:', error);
      }),
    ),
  );
};

export const createEnvelopeRouteCaller = async ({
  userId,
  teamId,
  input,
  apiRequestMetadata,
  logger,
  options = {},
}: CreateEnvelopeRouteOptions) => {
  const { payload, files = [], fileKeys = [] } = input;

  const {
    title,
    type,
    externalId,
    visibility,
    globalAccessAuth,
    globalActionAuth,
    formValues,
    recipients,
    folderId,
    meta,
    attachments,
    delegatedDocumentOwner,
  } = payload;

  if (files.length === 0 && fileKeys.length === 0) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'At least one file or file key is required',
    });
  }

  const { remaining, maximumEnvelopeItemCount } = await getServerLimits({
    userId,
    teamId,
  });

  if (remaining.documents <= 0) {
    throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
      message: 'You have reached your document limit for this month. Please upgrade your plan.',
      statusCode: 400,
    });
  }

  const temporaryUploadKeys: string[] = [];

  try {
    const uploadedFiles = await fetchUploadedFiles({
      userId,
      fileKeys,
      fetchedKeys: temporaryUploadKeys,
    });

    const allFiles = [...files, ...uploadedFiles];

    if (allFiles.length > maximumEnvelopeItemCount) {
      throw new AppError('ENVELOPE_ITEM_LIMIT_EXCEEDED', {
        message: `You cannot upload more than ${maximumEnvelopeItemCount} envelope items per envelope`,
        statusCode: 400,
      });
    }

    // For each file: convert to PDF if needed, normalize, extract & clean placeholders, then upload.
    const envelopeItems = await Promise.all(
      allFiles.map(async (file) => {
        let pdf = await convertToPdf(file, logger);

        if (formValues) {
          // eslint-disable-next-line require-atomic-updates
          pdf = await insertFormValuesInPdf({
            pdf,
            formValues,
          });
        }

        const normalized = await normalizePdf(pdf, {
          flattenForm: type !== EnvelopeType.TEMPLATE,
        });

        // Todo: Embeds - Might need to add this for client-side embeds in the future.
        const { cleanedPdf, placeholders } = await extractPdfPlaceholders(normalized);

        const { documentData } = await putPdfFileServerSide({
          name: file.name,
          type: 'application/pdf',
          arrayBuffer: async () => Promise.resolve(cleanedPdf),
        });

        return {
          title: file.name,
          documentDataId: documentData.id,
          placeholders,
        };
      }),
    );

    const recipientsToCreate = recipients?.map((recipient) => ({
      email: recipient.email,
      name: recipient.name,
      role: recipient.role,
      signingOrder: recipient.signingOrder,
      accessAuth: recipient.accessAuth,
      actionAuth: recipient.actionAuth,
      fields: recipient.fields?.map((field) => {
        const documentDataId = match(field.identifier)
          .with(P.string, (title) => envelopeItems.find((item) => item.title === title)?.documentDataId)
          .with(P.number, (index) => envelopeItems.at(index)?.documentDataId)
          .with(undefined, () => envelopeItems.at(0)?.documentDataId)
          .exhaustive();

        if (!documentDataId) {
          throw new AppError(AppErrorCode.NOT_FOUND, {
            message: 'Document data not found',
          });
        }

        return {
          ...field,
          documentDataId,
        };
      }),
    }));

    const envelope = await createEnvelope({
      userId,
      teamId,
      internalVersion: 2,
      data: {
        type,
        title,
        externalId,
        formValues,
        visibility,
        globalAccessAuth,
        globalActionAuth,
        recipients: recipientsToCreate,
        folderId,
        envelopeItems,
        delegatedDocumentOwner,
      },
      attachments,
      meta,
      requestMetadata: apiRequestMetadata,
      bypassDefaultRecipients: options.bypassDefaultRecipients,
    });

    return {
      id: envelope.id,
    };
  } finally {
    await deleteTemporaryUploads(temporaryUploadKeys);
  }
};
