import { prisma } from '@documenso/prisma';
import { DocumentDataType } from '@prisma/client';

import { deleteFile } from '../../universal/upload/delete-file';

/**
 * Remove document data (and its stored files) that no envelope item uses any more.
 *
 * Documents created from a template reuse the template's stored file, so a file is
 * only deleted once no remaining document data references it.
 */
export const deleteOrphanedDocumentData = async (documentDataIds: string[]) => {
  if (documentDataIds.length === 0) {
    return;
  }

  const orphanedDocumentData = await prisma.documentData.findMany({
    where: {
      id: { in: documentDataIds },
      envelopeItem: null,
    },
  });

  if (orphanedDocumentData.length === 0) {
    return;
  }

  await prisma.documentData.deleteMany({
    where: {
      id: { in: orphanedDocumentData.map((documentData) => documentData.id) },
      envelopeItem: null,
    },
  });

  const storedFileKeys = new Set(
    orphanedDocumentData
      .filter((documentData) => documentData.type === DocumentDataType.S3_PATH)
      .flatMap((documentData) => [documentData.data, documentData.initialData]),
  );

  for (const key of storedFileKeys) {
    const remainingReferences = await prisma.documentData.count({
      where: {
        OR: [{ data: key }, { initialData: key }],
      },
    });

    if (remainingReferences === 0) {
      await deleteFile({ type: DocumentDataType.S3_PATH, data: key });
    }
  }
};
