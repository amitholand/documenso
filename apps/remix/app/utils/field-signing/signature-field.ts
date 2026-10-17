import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TFieldSignature } from '@documenso/lib/types/field';
import { resolveSignatureTypes } from '@documenso/lib/utils/signature-field-types';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';
import { FieldType } from '@prisma/client';

import { SignFieldSignatureDialog } from '~/components/dialogs/sign-field-signature-dialog';

type HandleSignatureFieldClickOptions = {
  field: TFieldSignature;
  fullName?: string;
  signature: string | null;
  typedSignatureEnabled?: boolean;
  uploadSignatureEnabled?: boolean;
  drawSignatureEnabled?: boolean;
};

export const handleSignatureFieldClick = async (
  options: HandleSignatureFieldClickOptions,
): Promise<
  (Extract<TSignEnvelopeFieldValue, { type: typeof FieldType.SIGNATURE }> & { isReusableSignature?: boolean }) | null
> => {
  const { field, fullName, signature, typedSignatureEnabled, uploadSignatureEnabled, drawSignatureEnabled } = options;

  if (field.type !== FieldType.SIGNATURE) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid field type',
    });
  }

  if (field.inserted) {
    return {
      type: FieldType.SIGNATURE,
      value: null,
    };
  }

  const resolvedSignatureTypes = resolveSignatureTypes(field.fieldMeta, {
    typedSignatureEnabled,
    uploadSignatureEnabled,
    drawSignatureEnabled,
  });

  // Fields with their own signature types (e.g. a company stamp) always ask for a new value.
  let signatureToInsert = resolvedSignatureTypes.hasFieldSignatureTypes ? null : signature;

  if (!signatureToInsert) {
    signatureToInsert = await SignFieldSignatureDialog.call({
      fullName,
      label: field.fieldMeta?.label,
      typedSignatureEnabled: resolvedSignatureTypes.typedSignatureEnabled,
      uploadSignatureEnabled: resolvedSignatureTypes.uploadSignatureEnabled,
      drawSignatureEnabled: resolvedSignatureTypes.drawSignatureEnabled,
    });
  }

  if (!signatureToInsert) {
    return null;
  }

  return {
    type: FieldType.SIGNATURE,
    value: signatureToInsert,
    isReusableSignature: !resolvedSignatureTypes.hasFieldSignatureTypes,
  };
};
