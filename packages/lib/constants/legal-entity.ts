import { env } from '../utils/env';

/**
 * The legal entity that operates this instance, shown on the Terms of Use and Privacy
 * Policy pages. The pages are only published once name, number and contact email are set.
 */
export const getLegalEntity = () => {
  const name = env('NEXT_PUBLIC_LEGAL_ENTITY_NAME')?.trim();
  const number = env('NEXT_PUBLIC_LEGAL_ENTITY_NUMBER')?.trim();
  const contactEmail = env('NEXT_PUBLIC_LEGAL_CONTACT_EMAIL')?.trim();
  const address = env('NEXT_PUBLIC_LEGAL_ENTITY_ADDRESS')?.trim() || null;
  const retentionYears = Number(env('NEXT_PUBLIC_LEGAL_DOCUMENT_RETENTION_YEARS')) || 7;

  if (!name || !number || !contactEmail) {
    return null;
  }

  return { name, number, contactEmail, address, retentionYears };
};

export type TLegalEntity = NonNullable<ReturnType<typeof getLegalEntity>>;

export const LEGAL_TERMS_PATH = '/articles/terms';
export const LEGAL_PRIVACY_PATH = '/articles/privacy';
