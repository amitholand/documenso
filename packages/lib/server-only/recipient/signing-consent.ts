import { createHash } from 'node:crypto';

import {
  fillStampAuthorityText,
  getSigningConsentLocale,
  isStampSignatureField,
  SIGNING_CONSENT_TEXTS,
  SIGNING_CONSENT_VERSION,
  type TStampDeclaration,
} from '@documenso/lib/constants/signing-consent';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import { DocumentStatus, RecipientRole, SigningStatus } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

const findRecipientWithStampFields = async (token: string) => {
  const recipient = await prisma.recipient.findFirst({
    where: { token },
    include: {
      envelope: { select: { id: true, status: true, deletedAt: true } },
      fields: { include: { signature: true } },
    },
  });

  if (!recipient) {
    throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Recipient not found' });
  }

  const signedStampFields = recipient.fields.filter((field) => field.inserted && isStampSignatureField(field));

  return { recipient, signedStampFields };
};

export type RecordSigningConsentOptions = {
  token: string;
  locale: string;
  stamp?: TStampDeclaration;
  requestMetadata?: RequestMetadata;
};

/**
 * Store the exact consent texts a recipient approved, with their hash, IP and user agent.
 */
export const recordSigningConsent = async ({ token, locale, stamp, requestMetadata }: RecordSigningConsentOptions) => {
  const { recipient, signedStampFields } = await findRecipientWithStampFields(token);

  if (recipient.envelope.status !== DocumentStatus.PENDING || recipient.envelope.deletedAt) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, { message: 'Document is not pending signature' });
  }

  if (recipient.signingStatus === SigningStatus.SIGNED) {
    throw new AppError(AppErrorCode.RECIPIENT_ALREADY_SIGNED, { message: 'Recipient has already signed' });
  }

  if (signedStampFields.length > 0 && !stamp) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'A stamp authority declaration is required when a company stamp was uploaded',
    });
  }

  const consentLocale = getSigningConsentLocale(locale);
  const consentTexts = SIGNING_CONSENT_TEXTS[consentLocale];

  const texts = [consentTexts.electronicSignature, consentTexts.termsAndPrivacy];

  if (stamp && signedStampFields.length > 0) {
    texts.push(fillStampAuthorityText(consentTexts.stampAuthority, stamp), consentTexts.stampNotVerified);
  }

  await prisma.documentAuditLog.create({
    data: createDocumentAuditLogData({
      type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_CONSENT_ACCEPTED,
      envelopeId: recipient.envelope.id,
      user: {
        name: recipient.name,
        email: recipient.email,
      },
      requestMetadata,
      data: {
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        recipientId: recipient.id,
        recipientRole: recipient.role,
        consentVersion: SIGNING_CONSENT_VERSION,
        locale: consentLocale,
        texts,
        textsSha256: sha256(texts.join('\n')),
        stamp:
          stamp && signedStampFields.length > 0
            ? {
                ...stamp,
                stampImagesSha256: signedStampFields.map((field) =>
                  sha256(field.signature?.signatureImageAsBase64 ?? field.customText),
                ),
              }
            : undefined,
      },
    }),
  });
};

/**
 * Signers must approve the current consent texts (and declare stamp authority when
 * a stamp was uploaded) after their last stamp upload and before completing.
 */
export const assertRecipientSigningConsent = async ({ token }: { token: string }) => {
  const { recipient, signedStampFields } = await findRecipientWithStampFields(token);

  if (recipient.role !== RecipientRole.SIGNER) {
    return;
  }

  const consentLogs = await prisma.documentAuditLog.findMany({
    where: {
      envelopeId: recipient.envelope.id,
      type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_CONSENT_ACCEPTED,
      data: { path: ['recipientId'], equals: recipient.id },
    },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });

  const latestConsent = consentLogs[0];
  const consentData = latestConsent?.data as { consentVersion?: string; stamp?: unknown } | undefined;

  if (!latestConsent || consentData?.consentVersion !== SIGNING_CONSENT_VERSION) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'The signer must approve the signing consent before completing',
    });
  }

  if (signedStampFields.length === 0) {
    return;
  }

  const lastStampSignedAt = Math.max(...signedStampFields.map((field) => field.signature?.created.getTime() ?? 0));

  if (!consentData.stamp || latestConsent.createdAt.getTime() < lastStampSignedAt) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'The signer must declare authority to use the company stamp before completing',
    });
  }
};
