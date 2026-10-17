import { describe, expect, it } from 'vitest';

import { getSignatureValueError, resolveSignatureTypes } from './signature-field-types';

const IMAGE = 'data:image/png;base64,iVBORw0KGgo=';

describe('resolveSignatureTypes', () => {
  it('uses the document settings when the field has no signature types', () => {
    expect(
      resolveSignatureTypes(
        { type: 'signature' },
        { typedSignatureEnabled: false, uploadSignatureEnabled: true, drawSignatureEnabled: true },
      ),
    ).toEqual({
      typedSignatureEnabled: false,
      uploadSignatureEnabled: true,
      drawSignatureEnabled: true,
      hasFieldSignatureTypes: false,
    });
  });

  it('lets the field override the document settings', () => {
    expect(
      resolveSignatureTypes(
        { type: 'signature', signatureTypes: ['upload'] },
        { typedSignatureEnabled: true, uploadSignatureEnabled: false, drawSignatureEnabled: true },
      ),
    ).toEqual({
      typedSignatureEnabled: false,
      uploadSignatureEnabled: true,
      drawSignatureEnabled: false,
      hasFieldSignatureTypes: true,
    });
  });

  it('ignores invalid field meta', () => {
    expect(resolveSignatureTypes({ type: 'text' }, null).hasFieldSignatureTypes).toBe(false);
    expect(resolveSignatureTypes(null, null).hasFieldSignatureTypes).toBe(false);
  });
});

describe('getSignatureValueError', () => {
  const stamp = { type: 'signature', signatureTypes: ['upload'] };

  it('rejects a typed signature on an upload-only field', () => {
    expect(getSignatureValueError('John Doe', stamp)).not.toBeNull();
  });

  it('accepts an image on an upload-only field', () => {
    expect(getSignatureValueError(IMAGE, stamp)).toBeNull();
  });

  it('rejects an image on a type-only field', () => {
    expect(getSignatureValueError(IMAGE, { type: 'signature', signatureTypes: ['type'] })).not.toBeNull();
  });

  it('keeps the document typed-signature setting for regular fields', () => {
    expect(getSignatureValueError('John Doe', { type: 'signature' }, { typedSignatureEnabled: false })).not.toBeNull();
    expect(getSignatureValueError('John Doe', { type: 'signature' }, { typedSignatureEnabled: true })).toBeNull();
  });
});
