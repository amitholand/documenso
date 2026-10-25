import { NEXT_PUBLIC_WEBAPP_URL } from './app';

export const DEFAULT_STANDARD_FONT_SIZE = 12;
export const DEFAULT_HANDWRITING_FONT_SIZE = 50;
export const DEFAULT_SIGNATURE_TEXT_FONT_SIZE = 18;

export const MIN_STANDARD_FONT_SIZE = 8;
export const MIN_HANDWRITING_FONT_SIZE = 20;

export const CAVEAT_FONT_PATH = () => `${NEXT_PUBLIC_WEBAPP_URL()}/fonts/caveat.ttf`;

const SIGNATURE_FONT_FAMILY_CAVEAT = 'Caveat';

// CN-before-JP: the JP Noto file's Han glyphs use JP shapes, so pure-CN
// text would otherwise render with JP forms. Family names sync with
// apps/remix/app/app.css and packages/lib/server-only/pdf/helpers.ts.
const SIGNATURE_FONT_FAMILY_NOTO =
  '"Noto Sans", "Noto Sans Hebrew", "Noto Sans Chinese", "Noto Sans Japanese", "Noto Sans Korean", sans-serif';

/**
 * Font family for the text of generated PDFs such as the signing certificate and audit log.
 *
 * Inter has no Hebrew glyphs, so Hebrew falls back to Noto Sans Hebrew. Family names sync with
 * packages/lib/server-only/pdf/helpers.ts.
 */
export const PDF_TEXT_FONT_FAMILY = 'Inter, "Noto Sans Hebrew"';

const isASCII = (str: string) => /^\p{ASCII}*$/u.test(str);

// Deliberately never mix handwriting + sans-serif within one signature.
export const getSignatureFontFamily = (typedSignatureText: string): string =>
  isASCII(typedSignatureText) ? SIGNATURE_FONT_FAMILY_CAVEAT : SIGNATURE_FONT_FAMILY_NOTO;

export const PDF_SIZE_A4_72PPI = {
  width: 595,
  height: 842,
};
