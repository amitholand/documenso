import { prisma } from '@documenso/prisma';
import { EnvelopeType, WebhookTriggerEvents } from '@prisma/client';

import { mapEnvelopeToWebhookDocumentPayload, ZWebhookDocumentSchema } from '../../types/webhook-payload';
import type { EnvelopeIdOptions } from '../../utils/envelope';
import { deleteOrphanedDocumentData } from '../document/delete-orphaned-document-data';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

export type DeleteTemplateOptions = {
  id: EnvelopeIdOptions;
  userId: number;
  teamId: number;
};

export const deleteTemplate = async ({ id, userId, teamId }: DeleteTemplateOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    type: EnvelopeType.TEMPLATE,
    userId,
    teamId,
  });

  const templateToDelete = await prisma.envelope.findUniqueOrThrow({
    where: envelopeWhereInput,
    include: { documentMeta: true, recipients: true },
  });

  const envelopeItems = await prisma.envelopeItem.findMany({
    where: { envelopeId: templateToDelete.id },
    select: { documentDataId: true },
  });

  const deletedTemplate = await prisma.envelope.delete({
    where: envelopeWhereInput,
  });

  // Files shared with documents created from this template are kept.
  await deleteOrphanedDocumentData(envelopeItems.map((item) => item.documentDataId)).catch((err) => {
    console.error('Failed to delete stored files for deleted template', templateToDelete.id, err);
  });

  await triggerWebhook({
    event: WebhookTriggerEvents.TEMPLATE_DELETED,
    data: ZWebhookDocumentSchema.parse(mapEnvelopeToWebhookDocumentPayload(templateToDelete)),
    userId,
    teamId,
  });

  return deletedTemplate;
};
