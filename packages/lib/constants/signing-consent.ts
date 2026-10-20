/**
 * Legal consent texts a signer must explicitly approve before completing a signature.
 *
 * The exact text shown to the signer is stored in the audit log together with its
 * SHA-256, so any change to these texts MUST bump `SIGNING_CONSENT_VERSION`.
 */
export const SIGNING_CONSENT_VERSION = '2026-10-20';

export type TSigningConsentLocale = 'he' | 'en';

export type TSigningConsentTexts = {
  electronicSignature: string;
  termsAndPrivacy: string;
  stampAuthority: string;
  stampNotVerified: string;
};

export const SIGNING_CONSENT_TEXTS: Record<TSigningConsentLocale, TSigningConsentTexts> = {
  he: {
    electronicSignature:
      'אני מאשר/ת כי קראתי את המסמך במלואו, כי אני מסכים/ה לחתום עליו באמצעים אלקטרוניים, וכי חתימתי האלקטרונית מהווה את חתימתי לכל דבר ועניין ומחייבת אותי כחתימת ידי.',
    termsAndPrivacy:
      'קראתי ואני מסכים/ה לתנאי השימוש ולמדיניות הפרטיות. ידוע לי כי לצורך תיעוד החתימה ואימותה יישמרו שמי, כתובת הדוא"ל, כתובת IP, פרטי הדפדפן ומועד כל פעולה; כי המידע יימסר לשולח המסמך ולצדדים לו ויישמר בשרתים באיחוד האירופי; וכי אינני חייב/ת על פי דין למסור מידע זה, אך בלעדיו לא ניתן להשלים את החתימה.',
    stampAuthority:
      'אני מצהיר/ה כי אני מורשה חתימה מטעם {companyName}, ח.פ. {companyNumber}, בתפקיד {role}, וכי אני מוסמך/ת להשתמש בחותמת החברה ולחייב אותה במסמך זה. ידוע לי כי הצהרה כוזבת עלולה לחשוף אותי לאחריות אישית.',
    stampNotVerified:
      'החותמת הועלתה כתמונה על ידי החותם/ת ולא אומתה על ידי המערכת. תוקף ההתחייבות מטעם התאגיד נשען על הצהרת המורשה.',
  },
  en: {
    electronicSignature:
      'I confirm that I have read the entire document, that I agree to sign it electronically, and that my electronic signature is my signature for all purposes and binds me as my handwritten signature.',
    termsAndPrivacy:
      'I have read and agree to the Terms of Use and the Privacy Policy. I understand that, to record and verify this signature, my name, email address, IP address, browser details and the time of each action will be stored; that this information will be shared with the sender of the document and its parties and stored on servers in the European Union; and that I am not legally obliged to provide it, but the signature cannot be completed without it.',
    stampAuthority:
      'I declare that I am an authorised signatory of {companyName}, company number {companyNumber}, in the role of {role}, and that I am authorised to use the company stamp and to bind the company to this document. I understand that a false declaration may expose me to personal liability.',
    stampNotVerified:
      'The stamp was uploaded as an image by the signer and was not verified by the system. The company is bound based on the authorised signatory declaration.',
  },
};

export const getSigningConsentLocale = (locale: string | null | undefined): TSigningConsentLocale => {
  return locale?.startsWith('he') ? 'he' : 'en';
};

export type TStampDeclaration = {
  companyName: string;
  companyNumber: string;
  role: string;
};

export const fillStampAuthorityText = (text: string, declaration: TStampDeclaration) => {
  return text
    .replace('{companyName}', declaration.companyName)
    .replace('{companyNumber}', declaration.companyNumber)
    .replace('{role}', declaration.role);
};

/**
 * A stamp field is a signature field that only allows uploading an image.
 */
export const isStampSignatureField = (field: { type: string; fieldMeta: unknown }) => {
  if (field.type !== 'SIGNATURE' || !field.fieldMeta || typeof field.fieldMeta !== 'object') {
    return false;
  }

  const { signatureTypes } = field.fieldMeta as { signatureTypes?: unknown };

  return Array.isArray(signatureTypes) && signatureTypes.length === 1 && signatureTypes[0] === 'upload';
};
