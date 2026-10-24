import type {
  TPresignPdfUploadResponse,
  TUploadContentType,
  TUploadPdfResponse,
} from '@documenso/remix/server/api/files/files.types';

import { formatPath } from '../../constants/app';
import { DOCUMENT_CONVERSION_MIME_TYPE_DOCX } from '../../constants/document-conversion';
import { AppError } from '../../errors/app-error';

type File = {
  name: string;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

export type UploadedFileKey = {
  key: string;
  fileName: string;
  type: TUploadContentType;
};

const SUPPORTED_UPLOAD_CONTENT_TYPES: TUploadContentType[] = ['application/pdf', DOCUMENT_CONVERSION_MIME_TYPE_DOCX];

/**
 * Options for uploads that are not authorized by a logged-in session.
 *
 * Embedded authoring flows run cross-origin without a session cookie, so they
 * must authorize uploads with their embedding presign token instead.
 */
export type PutFileOptions = {
  presignToken?: string;
};

const buildUploadAuthHeaders = (options?: PutFileOptions): Record<string, string> => {
  if (!options?.presignToken) {
    return {};
  }

  return {
    Authorization: `Bearer ${options.presignToken}`,
  };
};

/**
 * Resolves the content type to sign. Uses the browser-reported type when it is supported,
 * otherwise falls back to the file extension (browsers often report an empty type for DOCX).
 */
const resolveUploadContentType = (file: File): TUploadContentType => {
  const matchedType = SUPPORTED_UPLOAD_CONTENT_TYPES.find((contentType) => contentType === file.type);

  if (matchedType) {
    return matchedType;
  }

  const lowerCaseName = file.name.toLowerCase();

  if (lowerCaseName.endsWith('.pdf')) {
    return 'application/pdf';
  }

  if (lowerCaseName.endsWith('.docx')) {
    return DOCUMENT_CONVERSION_MIME_TYPE_DOCX;
  }

  throw new AppError('UNSUPPORTED_FILE_TYPE');
};

/**
 * Uploads any supported file (PDF or DOCX) straight to object storage using a presigned URL.
 * Returns the storage key so the caller can pass it to the server instead of the file bytes.
 */
export const putFileToStorage = async (file: File, options?: PutFileOptions): Promise<UploadedFileKey> => {
  const authHeaders = buildUploadAuthHeaders(options);
  const contentType = resolveUploadContentType(file);
  const buffer = await file.arrayBuffer();

  const presignResponse = await fetch(formatPath('/api/files/presign-pdf-upload'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({ fileName: file.name, contentType }),
  });

  if (!presignResponse.ok) {
    console.error('Upload failed:', presignResponse.statusText);
    throw new AppError('UPLOAD_FAILED');
  }

  const { key, url }: TPresignPdfUploadResponse = await presignResponse.json();

  const uploadResponse = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: buffer,
  });

  if (!uploadResponse.ok) {
    console.error('Upload failed:', uploadResponse.statusText);
    throw new AppError('UPLOAD_FAILED');
  }

  return {
    key,
    fileName: file.name,
    type: contentType,
  };
};

/**
 * Uploads a PDF straight to object storage using a presigned URL, then asks the server
 * to finalize it. This keeps the file out of the function request body, which is capped.
 */
export const putPdfFile = async (file: File, options?: PutFileOptions) => {
  const authHeaders = buildUploadAuthHeaders(options);
  const buffer = await file.arrayBuffer();

  const presignResponse = await fetch(formatPath('/api/files/presign-pdf-upload'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({ fileName: file.name }),
  });

  if (!presignResponse.ok) {
    console.error('Upload failed:', presignResponse.statusText);
    throw new AppError('UPLOAD_FAILED');
  }

  const { key, url }: TPresignPdfUploadResponse = await presignResponse.json();

  const uploadResponse = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body: buffer,
  });

  if (!uploadResponse.ok) {
    console.error('Upload failed:', uploadResponse.statusText);
    throw new AppError('UPLOAD_FAILED');
  }

  const response = await fetch(formatPath('/api/files/upload-pdf-from-key'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({ key, fileName: file.name }),
  });

  if (!response.ok) {
    console.error('Upload failed:', response.statusText);
    throw new AppError('UPLOAD_FAILED');
  }

  const result: TUploadPdfResponse = await response.json();

  return result;
};
