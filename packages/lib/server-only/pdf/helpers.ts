import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { FontLibrary } from '@documenso/skia-canvas';
import type { Recipient } from '@prisma/client';
import { FieldType } from '@prisma/client';
import { match } from 'ts-pattern';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';

/**
 * Reads a file from the public folder.
 *
 * Uses the copy in the function bundle or in public/ when it exists. Otherwise it fetches the file
 * from the public URL, since Vercel does not always include public/ in the function.
 */
export const readPublicAsset = async (relativePath: string) => {
  const localPaths = [
    path.join(process.cwd(), 'build/server/hono/public', relativePath),
    path.join(process.cwd(), 'public', relativePath),
  ];
  const localPath = localPaths.find((candidate) => fs.existsSync(candidate));

  if (localPath) {
    return fs.promises.readFile(localPath);
  }

  const response = await fetch(new URL(relativePath, `${NEXT_PUBLIC_WEBAPP_URL()}/`));

  if (!response.ok) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, { message: `Failed to load public asset ${relativePath}` });
  }

  return Buffer.from(await response.arrayBuffer());
};

/**
 * Returns a file path for a font, writing it to the temp folder first when it is only available remotely.
 */
const resolveFontFilePath = async (fileName: string) => {
  const relativePath = path.join('fonts', fileName);
  const localPath = [
    path.join(process.cwd(), 'build/server/hono/public', relativePath),
    path.join(process.cwd(), 'public', relativePath),
  ].find((candidate) => fs.existsSync(candidate));

  if (localPath) {
    return localPath;
  }

  const tempPath = path.join(os.tmpdir(), 'documenso-fonts', fileName);

  if (!fs.existsSync(tempPath)) {
    fs.mkdirSync(path.dirname(tempPath), { recursive: true });
    fs.writeFileSync(tempPath, await readPublicAsset(relativePath));
  }

  return tempPath;
};

let fontLibraryPromise: Promise<void> | null = null;

const registerFonts = async () => {
  if (!FontLibrary.has('Caveat')) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    FontLibrary.use({
      ['Caveat']: [await resolveFontFilePath('caveat.ttf')],
    });
  }

  if (!FontLibrary.has('Inter')) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    FontLibrary.use({
      ['Inter']: [await resolveFontFilePath('inter-variablefont_opsz,wght.ttf')],
    });
  }

  if (!FontLibrary.has('Noto Sans Hebrew')) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    FontLibrary.use({
      ['Noto Sans Hebrew']: [await resolveFontFilePath('noto-sans-hebrew.ttf')],
    });
  }

  if (!FontLibrary.has('Noto Sans')) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    FontLibrary.use({
      ['Noto Sans']: [await resolveFontFilePath('noto-sans.ttf')],
      ['Noto Sans Japanese']: [await resolveFontFilePath('noto-sans-japanese.ttf')],
      ['Noto Sans Chinese']: [await resolveFontFilePath('noto-sans-chinese.ttf')],
      ['Noto Sans Korean']: [await resolveFontFilePath('noto-sans-korean.ttf')],
    });
  }
};

/**
 * Ensure all required fonts are registered in the skia-canvas FontLibrary.
 *
 * Fonts are registered once per process and retained — calling this multiple
 * times is a no-op after the first invocation.
 */
export const ensureFontLibrary = () => {
  fontLibraryPromise ??= registerFonts().catch((error) => {
    fontLibraryPromise = null;

    throw error;
  });

  return fontLibraryPromise;
};

type RecipientPlaceholderInfo = {
  email: string;
  name: string;
  recipientIndex: number;
};

/*
  Parse field type string to FieldType enum.
  Normalizes the input (uppercase, trim) and validates it's a valid field type.
  This ensures we handle case variations and whitespace, and provides clear error messages.
*/
export const parseFieldTypeFromPlaceholder = (fieldTypeString: string): FieldType => {
  const normalizedType = fieldTypeString.toUpperCase().trim();

  return match(normalizedType)
    .with('SIGNATURE', () => FieldType.SIGNATURE)
    .with('FREE_SIGNATURE', () => FieldType.FREE_SIGNATURE)
    .with('INITIALS', () => FieldType.INITIALS)
    .with('NAME', () => FieldType.NAME)
    .with('EMAIL', () => FieldType.EMAIL)
    .with('DATE', () => FieldType.DATE)
    .with('TEXT', () => FieldType.TEXT)
    .with('NUMBER', () => FieldType.NUMBER)
    .with('RADIO', () => FieldType.RADIO)
    .with('CHECKBOX', () => FieldType.CHECKBOX)
    .with('DROPDOWN', () => FieldType.DROPDOWN)
    .otherwise(() => {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: `Invalid field type: ${fieldTypeString}`,
      });
    });
};

/*
  Transform raw field metadata from placeholder format to schema format.
  Users should provide properly capitalized property names (e.g., readOnly, fontSize, textAlign).
  Converts string values to proper types (booleans, numbers).
*/
export const parseFieldMetaFromPlaceholder = (
  rawFieldMeta: Record<string, string>,
  fieldType: FieldType,
): Record<string, unknown> | undefined => {
  if (fieldType === FieldType.SIGNATURE || fieldType === FieldType.FREE_SIGNATURE) {
    return;
  }

  if (Object.keys(rawFieldMeta).length === 0) {
    return;
  }

  const fieldTypeString = String(fieldType).toLowerCase();

  const parsedFieldMeta: Record<string, boolean | number | string> = {
    type: fieldTypeString,
  };

  /*
    rawFieldMeta is an object with string keys and string values.
    It contains string values because the PDF parser returns the values as strings.

    E.g. { 'required': 'true', 'fontSize': '12', 'maxValue': '100', 'minValue': '0', 'characterLimit': '100' }
  */
  const rawFieldMetaEntries = Object.entries(rawFieldMeta);

  for (const [property, value] of rawFieldMetaEntries) {
    if (property === 'readOnly' || property === 'required') {
      parsedFieldMeta[property] = value === 'true';
    } else if (
      property === 'fontSize' ||
      property === 'maxValue' ||
      property === 'minValue' ||
      property === 'characterLimit'
    ) {
      const numValue = Number(value);

      if (!Number.isNaN(numValue)) {
        parsedFieldMeta[property] = numValue;
      }
    } else {
      parsedFieldMeta[property] = value;
    }
  }

  return parsedFieldMeta;
};

const extractRecipientPlaceholder = (placeholder: string): RecipientPlaceholderInfo => {
  const indexMatch = placeholder.match(/^r(\d+)$/i);

  if (!indexMatch) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: `Invalid recipient placeholder format: ${placeholder}. Expected format: r1, r2, r3, etc.`,
    });
  }

  const recipientIndex = Number(indexMatch[1]);

  return {
    email: `recipient.${recipientIndex}@documenso.com`,
    name: `Recipient ${recipientIndex}`,
    recipientIndex,
  };
};

/*
  Finds a recipient based on a placeholder reference.
  If recipients array is provided, uses index-based matching (r1 -> recipients[0], etc.).
  Otherwise, uses email-based matching from createdRecipients.
*/
export const findRecipientByPlaceholder = (
  recipientPlaceholder: string,
  placeholder: string,
  recipients: Pick<Recipient, 'id' | 'email'>[] | undefined,
  createdRecipients: Pick<Recipient, 'id' | 'email'>[],
): Pick<Recipient, 'id' | 'email'> => {
  if (recipients && recipients.length > 0) {
    /*
      Map placeholder by index: r1 -> recipients[0], r2 -> recipients[1], etc.
      recipientIndex is 1-based, so we subtract 1 to get the array index.
    */
    const { recipientIndex } = extractRecipientPlaceholder(recipientPlaceholder);
    const recipientArrayIndex = recipientIndex - 1;

    if (recipientArrayIndex < 0 || recipientArrayIndex >= recipients.length) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: `Recipient placeholder ${recipientPlaceholder} (index ${recipientIndex}) is out of range. Provided ${recipients.length} recipient(s).`,
      });
    }

    return recipients[recipientArrayIndex];
  }

  /*
    Use email-based matching for placeholder recipients.
  */
  const { email } = extractRecipientPlaceholder(recipientPlaceholder);
  const recipient = createdRecipients.find((r) => r.email === email);

  if (!recipient) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: `Could not find recipient ID for placeholder: ${placeholder}`,
    });
  }

  return recipient;
};
