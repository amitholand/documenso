import { isBase64Image } from '../constants/signatures';
import type { TSignatureFieldType } from '../types/field-meta';
import { ZSignatureFieldMeta } from '../types/field-meta';

export type SignatureTypeSettings = {
  typedSignatureEnabled?: boolean | null;
  uploadSignatureEnabled?: boolean | null;
  drawSignatureEnabled?: boolean | null;
};

export type ResolvedSignatureTypes = {
  typedSignatureEnabled: boolean;
  uploadSignatureEnabled: boolean;
  drawSignatureEnabled: boolean;

  /**
   * Whether the field defines its own signature types.
   *
   * Fields with their own types (for example a company stamp) must not reuse the
   * signer's regular signature, and their value must not become the regular signature.
   */
  hasFieldSignatureTypes: boolean;
};

export const getFieldSignatureTypes = (fieldMeta: unknown): TSignatureFieldType[] | null => {
  const parsed = ZSignatureFieldMeta.safeParse(fieldMeta);

  if (!parsed.success || !parsed.data.signatureTypes?.length) {
    return null;
  }

  return parsed.data.signatureTypes;
};

/**
 * Resolve which signature types a signature field accepts.
 *
 * The field's own `signatureTypes` win over the document settings when present.
 */
export const resolveSignatureTypes = (
  fieldMeta: unknown,
  documentSettings?: SignatureTypeSettings | null,
): ResolvedSignatureTypes => {
  const fieldTypes = getFieldSignatureTypes(fieldMeta);

  if (fieldTypes) {
    return {
      typedSignatureEnabled: fieldTypes.includes('type'),
      uploadSignatureEnabled: fieldTypes.includes('upload'),
      drawSignatureEnabled: fieldTypes.includes('draw'),
      hasFieldSignatureTypes: true,
    };
  }

  return {
    typedSignatureEnabled: documentSettings?.typedSignatureEnabled !== false,
    uploadSignatureEnabled: documentSettings?.uploadSignatureEnabled !== false,
    drawSignatureEnabled: documentSettings?.drawSignatureEnabled !== false,
    hasFieldSignatureTypes: false,
  };
};

/**
 * Returns an error message when the value is not allowed for the field, otherwise null.
 *
 * Note: drawn and uploaded signatures are both PNG images, so the server cannot tell
 * them apart. An upload-only field rejects typed signatures but accepts any image.
 */
export const getSignatureValueError = (
  value: string,
  fieldMeta: unknown,
  documentSettings?: SignatureTypeSettings | null,
): string | null => {
  const { typedSignatureEnabled, uploadSignatureEnabled, drawSignatureEnabled } = resolveSignatureTypes(
    fieldMeta,
    documentSettings,
  );

  const isImage = isBase64Image(value);

  if (!isImage && !typedSignatureEnabled) {
    return 'Typed signatures are not allowed for this field';
  }

  if (isImage && !uploadSignatureEnabled && !drawSignatureEnabled) {
    return 'Image signatures are not allowed for this field';
  }

  return null;
};
