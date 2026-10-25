import { useAnalytics } from '@documenso/lib/client-only/hooks/use-analytics';
import { NEXT_PUBLIC_PRIVACY_POLICY_URL, NEXT_PUBLIC_TERMS_OF_SERVICE_URL } from '@documenso/lib/constants/app';
import { getLegalEntity, LEGAL_PRIVACY_PATH, LEGAL_TERMS_PATH } from '@documenso/lib/constants/legal-entity';
import {
  fillStampAuthorityText,
  getSigningConsentLocale,
  isStampSignatureField,
  SIGNING_CONSENT_TEXTS,
} from '@documenso/lib/constants/signing-consent';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { type TRecipientAccessAuth, ZDocumentAccessAuthSchema } from '@documenso/lib/types/document-auth';
import { ZFieldMetaSchema } from '@documenso/lib/types/field-meta';
import {
  fieldsContainUnsignedRequiredField,
  isFieldUnsignedAndRequired,
} from '@documenso/lib/utils/advanced-fields-helpers';
import { zEmail } from '@documenso/lib/utils/zod';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { FRIENDLY_FIELD_TYPE } from '@documenso/ui/primitives/document-flow/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import type { Field, Recipient } from '@prisma/client';
import { RecipientRole } from '@prisma/client';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { type Control, useForm } from 'react-hook-form';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { useEmbedSigningContext } from '~/components/embed/embed-signing-context';
import { AccessAuth2FAForm } from '~/components/general/document-signing/access-auth-2fa-form';
import { DocumentSigningDisclosure } from '~/components/general/document-signing/document-signing-disclosure';

import { getSigningCompletionErrorMessage } from '~/utils/toast-error-messages';

import { useRequiredDocumentSigningAuthContext } from './document-signing-auth-provider';

export type DocumentSigningCompleteDialogProps = {
  isSubmitting: boolean;
  documentTitle: string;
  fields: Field[];
  fieldsValidated: () => void | Promise<void>;
  onSignatureComplete: (
    nextSigner?: { name: string; email: string },
    accessAuthOptions?: TRecipientAccessAuth,
    directRecipient?: { name: string; email: string },
  ) => void | Promise<void>;
  recipient: Pick<Recipient, 'name' | 'email' | 'role' | 'token'>;
  disabled?: boolean;
  allowDictateNextSigner?: boolean;
  defaultNextSigner?: {
    name: string;
    email: string;
  };
  recipientPayload?: {
    name: string;
    email: string;
  };
  buttonSize?: 'sm' | 'lg';
  position?: 'start' | 'end' | 'center';
  disableNameInput?: boolean;

  /** Whether the recipient uploaded a company stamp. Defaults to checking `fields`. */
  hasStampSignature?: boolean;

  /** Direct templates create the recipient on completion, so consent can't be recorded beforehand. */
  skipConsentRecording?: boolean;

  /** When provided, replaces the confirmation form (and 2FA step) as the dialog body. */
  children?: ReactNode;

  onOpenChange?: (open: boolean) => void;
};

const ZNextSignerFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: zEmail('Invalid email address'),
  accessAuthOptions: ZDocumentAccessAuthSchema.optional(),
});

type TNextSignerFormSchema = z.infer<typeof ZNextSignerFormSchema>;

const ZDirectRecipientFormSchema = z.object({
  name: z.string(),
  email: zEmail('Invalid email address'),
});

type TDirectRecipientFormSchema = z.infer<typeof ZDirectRecipientFormSchema>;

const ZSigningConsentFormSchema = z.object({
  hasStamp: z.boolean(),
  electronicSignature: z.boolean(),
  termsAndPrivacy: z.boolean(),
  stampAuthority: z.boolean(),
  companyName: z.string().trim(),
  companyNumber: z.string().trim(),
  role: z.string().trim(),
});

const buildSigningConsentFormSchema = (messages: { approvalRequired: string; required: string }) =>
  ZSigningConsentFormSchema.superRefine((data, ctx) => {
    for (const key of ['electronicSignature', 'termsAndPrivacy'] as const) {
      if (!data[key]) {
        ctx.addIssue({ code: 'custom', path: [key], message: messages.approvalRequired });
      }
    }

    if (!data.hasStamp) {
      return;
    }

    if (!data.stampAuthority) {
      ctx.addIssue({ code: 'custom', path: ['stampAuthority'], message: messages.approvalRequired });
    }

    for (const key of ['companyName', 'companyNumber', 'role'] as const) {
      if (!data[key]) {
        ctx.addIssue({ code: 'custom', path: [key], message: messages.required });
      }
    }
  });

type TSigningConsentFormSchema = z.infer<typeof ZSigningConsentFormSchema>;

export const DocumentSigningCompleteDialog = ({
  isSubmitting,
  documentTitle,
  fields,
  fieldsValidated,
  onSignatureComplete,
  recipient,
  disabled = false,
  allowDictateNextSigner = false,
  recipientPayload,
  defaultNextSigner,
  buttonSize = 'lg',
  position,
  disableNameInput = false,
  hasStampSignature,
  skipConsentRecording = false,
  children,
  onOpenChange,
}: DocumentSigningCompleteDialogProps) => {
  const analytics = useAnalytics();
  const { t, i18n } = useLingui();
  const { toast } = useToast();

  const [showDialog, setShowDialog] = useState(false);

  const [showTwoFactorForm, setShowTwoFactorForm] = useState(false);
  const [twoFactorValidationError, setTwoFactorValidationError] = useState<string | null>(null);

  const { derivedRecipientAccessAuth } = useRequiredDocumentSigningAuthContext();

  const { isNameLocked, isEmailLocked } = useEmbedSigningContext() || {};

  const canDictateNextSigner = allowDictateNextSigner && Boolean(defaultNextSigner);

  const form = useForm<TNextSignerFormSchema>({
    resolver: canDictateNextSigner ? zodResolver(ZNextSignerFormSchema) : undefined,
    defaultValues: {
      name: defaultNextSigner?.name ?? '',
      email: defaultNextSigner?.email ?? '',
    },
  });

  const recipientForm = useForm<TDirectRecipientFormSchema>({
    resolver: zodResolver(ZDirectRecipientFormSchema),
    values: {
      name: recipientPayload?.name ?? '',
      email: recipientPayload?.email ?? '',
    },
  });

  const isComplete = useMemo(() => !fieldsContainUnsignedRequiredField(fields), [fields]);

  const requiresConsent = recipient.role === RecipientRole.SIGNER;

  const hasStamp = useMemo(
    () => hasStampSignature ?? fields.some((field) => field.inserted && isStampSignatureField(field)),
    [hasStampSignature, fields],
  );

  const consentTexts = SIGNING_CONSENT_TEXTS[getSigningConsentLocale(i18n.locale)];

  const consentForm = useForm<TSigningConsentFormSchema>({
    resolver: zodResolver(
      buildSigningConsentFormSchema({
        approvalRequired: t`This approval is required`,
        required: t`Required`,
      }),
    ),
    defaultValues: {
      hasStamp,
      electronicSignature: false,
      termsAndPrivacy: false,
      stampAuthority: false,
      companyName: '',
      companyNumber: '',
      role: '',
    },
  });

  const stampDeclaration = consentForm.watch(['companyName', 'companyNumber', 'role']);

  const { mutateAsync: recordSigningConsent } = trpc.recipient.recordSigningConsent.useMutation();

  // Fall back to the built-in legal pages once the operating entity is configured.
  const hasLegalEntity = Boolean(getLegalEntity());
  const termsOfServiceUrl = NEXT_PUBLIC_TERMS_OF_SERVICE_URL() ?? (hasLegalEntity ? LEGAL_TERMS_PATH : undefined);
  const privacyPolicyUrl = NEXT_PUBLIC_PRIVACY_POLICY_URL() ?? (hasLegalEntity ? LEGAL_PRIVACY_PATH : undefined);

  // Name the field the "Next" button leads to, so signers know what they will fill in.
  const nextFieldName = useMemo(() => {
    const nextField = fields.find(isFieldUnsignedAndRequired);

    if (!nextField) {
      return null;
    }

    const label = ZFieldMetaSchema.safeParse(nextField.fieldMeta).data?.label;

    return label || i18n._(FRIENDLY_FIELD_TYPE[nextField.type]);
  }, [fields, i18n]);

  const completionRequires2FA = useMemo(
    () => derivedRecipientAccessAuth.includes('TWO_FACTOR_AUTH'),
    [derivedRecipientAccessAuth],
  );

  const handleOpenChange = (open: boolean) => {
    if (form.formState.isSubmitting || !isComplete) {
      return;
    }

    if (open) {
      form.reset({
        name: defaultNextSigner?.name ?? '',
        email: defaultNextSigner?.email ?? '',
      });

      consentForm.setValue('hasStamp', hasStamp);
    }

    setShowDialog(open);
    onOpenChange?.(open);
  };

  const onFormSubmit = async (data: TNextSignerFormSchema) => {
    try {
      let recipientOverridePayload: { name: string; email: string } | undefined;

      if (recipientPayload && !recipientPayload.email) {
        const isFormValid = await recipientForm.trigger();

        if (!isFormValid) {
          return;
        }

        recipientOverridePayload = recipientForm.getValues();
      } else if (recipientPayload && recipientPayload.email && !recipient.email) {
        // Form is hidden because we have an email (e.g. from embed context),
        // but the DB recipient doesn't have one yet — send the override.
        recipientOverridePayload = recipientPayload;
      }

      if (requiresConsent) {
        const isConsentValid = await consentForm.trigger();

        if (!isConsentValid) {
          return;
        }
      }

      // Check if 2FA is required
      if (completionRequires2FA && !data.accessAuthOptions) {
        setShowTwoFactorForm(true);
        return;
      }

      const nextSigner =
        allowDictateNextSigner && data.name && data.email ? { name: data.name, email: data.email } : undefined;

      if (requiresConsent && !skipConsentRecording) {
        const consent = consentForm.getValues();

        await recordSigningConsent({
          token: recipient.token,
          locale: i18n.locale,
          stamp: hasStamp
            ? { companyName: consent.companyName, companyNumber: consent.companyNumber, role: consent.role }
            : undefined,
        });
      }

      await onSignatureComplete(nextSigner, data.accessAuthOptions, recipientOverridePayload);
    } catch (error) {
      const err = AppError.parseError(error);

      if (AppErrorCode.TWO_FACTOR_AUTH_FAILED === err.code) {
        // This was a 2FA validation failure - show the 2FA dialog again with error
        form.setValue('accessAuthOptions', undefined);

        setTwoFactorValidationError('Invalid verification code. Please try again.');
        setShowTwoFactorForm(true);

        return;
      }

      analytics.captureException(error, {
        source: 'signing',
        location: 'complete_document',
      });

      // This dialog owns the completion error toast for every signing surface
      // so the user gets a specific, actionable message. Callers should run
      // their own side effects (e.g. embeds posting document-error) and
      // rethrow rather than toasting themselves.
      const toastMessage = getSigningCompletionErrorMessage(err.code);

      toast({
        title: i18n._(toastMessage.title),
        description: i18n._(toastMessage.description),
        variant: 'destructive',
      });
    }
  };

  const onTwoFactorFormSubmit = (validatedAuthOptions: TRecipientAccessAuth) => {
    form.setValue('accessAuthOptions', validatedAuthOptions);

    setShowTwoFactorForm(false);
    setTwoFactorValidationError(null);

    // Now trigger the form submission with auth options
    void form.handleSubmit(onFormSubmit)();
  };

  return (
    <Dialog open={showDialog} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          className="w-full"
          type="button"
          size={buttonSize}
          onClick={fieldsValidated}
          loading={isSubmitting}
          disabled={disabled}
        >
          {match({ isComplete, role: recipient.role })
            .with({ isComplete: false }, () =>
              nextFieldName ? (
                <span className="truncate">
                  <Trans>Next: {nextFieldName}</Trans>
                </span>
              ) : (
                <Trans>Next Field</Trans>
              ),
            )
            .with({ isComplete: true, role: RecipientRole.APPROVER }, () => <Trans>Approve</Trans>)
            .with({ isComplete: true, role: RecipientRole.VIEWER }, () => <Trans>Mark as viewed</Trans>)
            .with({ isComplete: true }, () => <Trans>Complete</Trans>)
            .exhaustive()}
        </Button>
      </DialogTrigger>

      <DialogContent position={position} className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <Trans>Are you sure?</Trans>
          </DialogTitle>
          <DialogDescription>
            <div className="max-w-[50ch] text-muted-foreground">
              {match(recipient.role)
                .with(RecipientRole.VIEWER, () => (
                  <span className="inline-flex flex-wrap">
                    <Trans>You are about to complete viewing the following document</Trans>
                  </span>
                ))
                .with(RecipientRole.SIGNER, () => (
                  <span className="inline-flex flex-wrap">
                    <Trans>You are about to complete signing the following document</Trans>
                  </span>
                ))
                .with(RecipientRole.APPROVER, () => (
                  <span className="inline-flex flex-wrap">
                    <Trans>You are about to complete approving the following document</Trans>
                  </span>
                ))
                .with(RecipientRole.ASSISTANT, () => (
                  <span className="inline-flex flex-wrap">
                    <Trans>You are about to complete assisting the following document</Trans>
                  </span>
                ))
                .with(RecipientRole.CC, () => null)
                .exhaustive()}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
          <p className="font-medium text-muted-foreground text-sm">{documentTitle}</p>
        </div>

        {match({ hasChildren: Boolean(children), showTwoFactorForm })
          .with({ hasChildren: true }, () => children)
          .with({ showTwoFactorForm: true }, () => (
            <AccessAuth2FAForm
              token={recipient.token}
              error={twoFactorValidationError}
              onSubmit={onTwoFactorFormSubmit}
            />
          ))
          .otherwise(() => (
            <fieldset disabled={form.formState.isSubmitting} className="border-none p-0">
              {recipientPayload && !recipientPayload.email && (
                <Form {...recipientForm}>
                  <div className="mb-4 flex flex-col gap-4">
                    <div className="flex flex-col gap-4 md:flex-row">
                      <FormField
                        control={recipientForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel>
                              <Trans>Your Name</Trans>
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                className="mt-2"
                                placeholder={t`Enter your name`}
                                disabled={isNameLocked || disableNameInput}
                              />
                            </FormControl>

                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={recipientForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel>
                              <Trans>Your Email</Trans>
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="email"
                                className="mt-2"
                                placeholder={t`Enter your email`}
                                disabled={!!field.value && isEmailLocked}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </Form>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onFormSubmit)}>
                  {canDictateNextSigner && (
                    <div className="mb-4 flex flex-col gap-4">
                      <div className="flex flex-col gap-4 md:flex-row">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormLabel>
                                <Trans>Next Recipient Name</Trans>
                              </FormLabel>
                              <FormControl>
                                <Input {...field} className="mt-2" placeholder={t`Enter the next signer's name`} />
                              </FormControl>

                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormLabel>
                                <Trans>Next Recipient Email</Trans>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="email"
                                  className="mt-2"
                                  placeholder={t`Enter the next signer's email`}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  {requiresConsent ? (
                    <Form {...consentForm}>
                      <div className="flex flex-col gap-3">
                        {hasStamp && (
                          <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                            <p className="font-medium text-sm">
                              <Trans>Company stamp authority</Trans>
                            </p>

                            <div className="flex flex-col gap-3 md:flex-row">
                              <FormField
                                control={consentForm.control}
                                name="companyName"
                                render={({ field }) => (
                                  <FormItem className="flex-1">
                                    <FormLabel>
                                      <Trans>Company name</Trans>
                                    </FormLabel>
                                    <FormControl>
                                      <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={consentForm.control}
                                name="companyNumber"
                                render={({ field }) => (
                                  <FormItem className="flex-1">
                                    <FormLabel>
                                      <Trans>Company number</Trans>
                                    </FormLabel>
                                    <FormControl>
                                      <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={consentForm.control}
                                name="role"
                                render={({ field }) => (
                                  <FormItem className="flex-1">
                                    <FormLabel>
                                      <Trans>Your role</Trans>
                                    </FormLabel>
                                    <FormControl>
                                      <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <SigningConsentCheckbox
                              control={consentForm.control}
                              name="stampAuthority"
                              text={fillStampAuthorityText(consentTexts.stampAuthority, {
                                companyName: stampDeclaration[0] || '___',
                                companyNumber: stampDeclaration[1] || '___',
                                role: stampDeclaration[2] || '___',
                              })}
                            />

                            <p className="text-muted-foreground text-xs">{consentTexts.stampNotVerified}</p>
                          </div>
                        )}

                        <SigningConsentCheckbox
                          control={consentForm.control}
                          name="electronicSignature"
                          text={consentTexts.electronicSignature}
                        />

                        <SigningConsentCheckbox
                          control={consentForm.control}
                          name="termsAndPrivacy"
                          text={consentTexts.termsAndPrivacy}
                        >
                          {(termsOfServiceUrl || privacyPolicyUrl) && (
                            <span className="mt-1 flex gap-3">
                              {termsOfServiceUrl && (
                                <a
                                  className="text-documenso-700 underline"
                                  href={termsOfServiceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Trans>Terms of Use</Trans>
                                </a>
                              )}
                              {privacyPolicyUrl && (
                                <a
                                  className="text-documenso-700 underline"
                                  href={privacyPolicyUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Trans>Privacy Policy</Trans>
                                </a>
                              )}
                            </span>
                          )}
                        </SigningConsentCheckbox>
                      </div>
                    </Form>
                  ) : (
                    <DocumentSigningDisclosure />
                  )}

                  <DialogFooter className="mt-4">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowDialog(false)}
                      disabled={form.formState.isSubmitting}
                    >
                      <Trans>Cancel</Trans>
                    </Button>

                    <Button type="submit" disabled={!isComplete} loading={form.formState.isSubmitting}>
                      {match(recipient.role)
                        .with(RecipientRole.VIEWER, () => <Trans>Mark as Viewed</Trans>)
                        .with(RecipientRole.SIGNER, () => <Trans>Sign</Trans>)
                        .with(RecipientRole.APPROVER, () => <Trans>Approve</Trans>)
                        .with(RecipientRole.CC, () => <Trans>Mark as Viewed</Trans>)
                        .with(RecipientRole.ASSISTANT, () => <Trans>Complete</Trans>)
                        .exhaustive()}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </fieldset>
          ))}
      </DialogContent>
    </Dialog>
  );
};

type SigningConsentCheckboxProps = {
  control: Control<TSigningConsentFormSchema>;
  name: 'electronicSignature' | 'termsAndPrivacy' | 'stampAuthority';
  text: string;
  children?: ReactNode;
};

const SigningConsentCheckbox = ({ control, name, text, children }: SigningConsentCheckboxProps) => {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <div className="flex items-start gap-2">
            <FormControl>
              <Checkbox
                id={`signing-consent-${name}`}
                className="mt-0.5"
                checked={field.value === true}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
            </FormControl>

            <label htmlFor={`signing-consent-${name}`} className="flex flex-col text-muted-foreground text-xs">
              {text}
              {children}
            </label>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
