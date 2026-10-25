import { prisma } from '@documenso/prisma';
import { EnvelopeType } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { EnvelopeIdOptions } from '../../utils/envelope';
import { mapSecondaryIdToTemplateId, unsafeBuildEnvelopeIdQuery } from '../../utils/envelope';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';
import { getTeamById } from '../team/get-team';

export type GetTemplateByIdOptions = {
  id: EnvelopeIdOptions;
  userId: number;
  teamId: number;

  /**
   * Allow any member of the team to read the template regardless of their role.
   *
   * The user must still belong to the team. Used for API token requests so every token in a
   * team sees the same templates.
   */
  ignoreVisibility?: boolean;
};

export const getTemplateById = async ({ id, userId, teamId, ignoreVisibility = false }: GetTemplateByIdOptions) => {
  const envelopeWhereInput = ignoreVisibility
    ? await getTeamWideTemplateWhereInput({ id, userId, teamId })
    : (
        await getEnvelopeWhereInput({
          id,
          type: EnvelopeType.TEMPLATE,
          userId,
          teamId,
        })
      ).envelopeWhereInput;

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
    include: {
      directLink: true,
      documentMeta: true,
      envelopeItems: {
        select: {
          id: true,
          envelopeId: true,
          documentData: true,
        },
      },
      recipients: true,
      fields: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      folder: true,
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Template not found',
    });
  }

  const firstTemplateDocumentData = envelope.envelopeItems[0].documentData;

  if (!firstTemplateDocumentData) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Template document data not found',
    });
  }

  // eslint-disable-next-line unused-imports/no-unused-vars
  const { envelopeItems, documentMeta, ...rest } = envelope;

  const legacyTemplateId = mapSecondaryIdToTemplateId(envelope.secondaryId);

  return {
    ...rest,
    envelopeId: envelope.id,
    type: envelope.templateType,
    templateDocumentDataId: firstTemplateDocumentData.id,
    templateDocumentData: {
      ...firstTemplateDocumentData,
      envelopeItemId: envelope.envelopeItems[0].id,
    },
    templateMeta: {
      ...envelope.documentMeta,
      templateId: legacyTemplateId,
    },
    fields: envelope.fields.map((field) => ({
      ...field,
      documentId: null,
      templateId: legacyTemplateId,
    })),
    recipients: envelope.recipients.map((recipient) => ({
      ...recipient,
      documentId: null,
      templateId: legacyTemplateId,
    })),
    directLink: envelope.directLink
      ? {
          ...envelope.directLink,
          templateId: legacyTemplateId,
        }
      : null,
    id: mapSecondaryIdToTemplateId(envelope.secondaryId),
    envelopeItems: envelope.envelopeItems.map((envelopeItem) => ({
      id: envelopeItem.id,
      envelopeId: envelopeItem.envelopeId,
    })),
  };
};

/**
 * Build a query that returns a template to any member of its team.
 *
 * Unlike `getEnvelopeWhereInput` this does not filter by document visibility, so it must only be
 * used for read access. The team lookup validates that the user belongs to the team.
 */
const getTeamWideTemplateWhereInput = async ({
  id,
  userId,
  teamId,
}: {
  id: EnvelopeIdOptions;
  userId: number;
  teamId: number;
}) => {
  const team = await getTeamById({ teamId, userId });

  return {
    ...unsafeBuildEnvelopeIdQuery(id, EnvelopeType.TEMPLATE),
    teamId: team.id,
  };
};
