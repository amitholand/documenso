import ApiTokenSchema from '@documenso/prisma/generated/zod/modelSchema/ApiTokenSchema';
import { z } from 'zod';

export const ZGetApiTokensRequestSchema = z
  .object({
    /**
     * The team to list tokens for. Defaults to the team in the request header.
     */
    teamId: z.number().optional(),
  })
  .optional();

export const ZGetApiTokensResponseSchema = z.array(
  ApiTokenSchema.pick({
    id: true,
    name: true,
    createdAt: true,
    expires: true,
    lastUsedAt: true,
  }),
);

export type TGetApiTokensResponse = z.infer<typeof ZGetApiTokensResponseSchema>;
