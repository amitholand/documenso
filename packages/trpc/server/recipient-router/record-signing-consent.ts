import { recordSigningConsent } from '@documenso/lib/server-only/recipient/signing-consent';

import { procedure } from '../trpc';
import {
  ZRecordSigningConsentRequestSchema,
  ZRecordSigningConsentResponseSchema,
} from './record-signing-consent.types';

/**
 * @private
 */
export const recordSigningConsentRoute = procedure
  .input(ZRecordSigningConsentRequestSchema)
  .output(ZRecordSigningConsentResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { token, locale, stamp } = input;

    ctx.logger.info({
      input: {
        locale,
        hasStamp: Boolean(stamp),
      },
    });

    await recordSigningConsent({
      token,
      locale,
      stamp,
      requestMetadata: ctx.metadata.requestMetadata,
    });
  });
