import { describe, expect, it } from 'vitest';

import {
  fillStampAuthorityText,
  getSigningConsentLocale,
  isStampSignatureField,
  SIGNING_CONSENT_TEXTS,
} from './signing-consent';

describe('isStampSignatureField', () => {
  it('detects upload-only signature fields', () => {
    expect(
      isStampSignatureField({ type: 'SIGNATURE', fieldMeta: { type: 'signature', signatureTypes: ['upload'] } }),
    ).toBe(true);
  });

  it('ignores regular signature fields', () => {
    expect(isStampSignatureField({ type: 'SIGNATURE', fieldMeta: null })).toBe(false);
    expect(isStampSignatureField({ type: 'SIGNATURE', fieldMeta: { signatureTypes: ['draw', 'upload'] } })).toBe(false);
    expect(isStampSignatureField({ type: 'TEXT', fieldMeta: { signatureTypes: ['upload'] } })).toBe(false);
  });
});

describe('fillStampAuthorityText', () => {
  it('fills the declaration placeholders', () => {
    const text = fillStampAuthorityText(SIGNING_CONSENT_TEXTS.he.stampAuthority, {
      companyName: 'יזמקו בע"מ',
      companyNumber: '512345678',
      role: 'מנכ"ל',
    });

    expect(text).toContain('יזמקו בע"מ');
    expect(text).toContain('512345678');
    expect(text).toContain('מנכ"ל');
    expect(text).not.toMatch(/\{(companyName|companyNumber|role)\}/);
  });
});

describe('getSigningConsentLocale', () => {
  it('falls back to English for non-Hebrew locales', () => {
    expect(getSigningConsentLocale('he')).toBe('he');
    expect(getSigningConsentLocale('he-IL')).toBe('he');
    expect(getSigningConsentLocale('fr')).toBe('en');
    expect(getSigningConsentLocale(undefined)).toBe('en');
  });
});
