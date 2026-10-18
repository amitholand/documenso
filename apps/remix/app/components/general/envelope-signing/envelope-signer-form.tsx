import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { RadioGroup, RadioGroupItem } from '@documenso/ui/primitives/radio-group';
import { Plural, Trans } from '@lingui/react/macro';
import { RecipientRole } from '@prisma/client';

import { useEmbedSigningContext } from '~/components/embed/embed-signing-context';

import { useRequiredEnvelopeSigningContext } from '../document-signing/envelope-signing-provider';

export default function EnvelopeSignerForm() {
  const {
    fullName,
    setFullName,
    recipient,
    assistantFields,
    assistantRecipients,
    selectedAssistantRecipient,
    setSelectedAssistantRecipientId,
  } = useRequiredEnvelopeSigningContext();

  const { isNameLocked, isEmailLocked } = useEmbedSigningContext() || {};

  const isSubmitting = false;

  if (recipient.role === RecipientRole.VIEWER) {
    return null;
  }

  if (recipient.role === RecipientRole.ASSISTANT) {
    return (
      <fieldset className="embed--DocumentWidgetForm rounded-2xl border-border sm:border sm:p-3 dark:bg-background">
        <RadioGroup
          className="gap-0 space-y-2 shadow-none sm:space-y-3"
          value={selectedAssistantRecipient?.id?.toString()}
          onValueChange={(value) => {
            setSelectedAssistantRecipientId(Number(value));
          }}
        >
          {assistantRecipients
            .filter((r) => r.fields.length > 0)
            .map((r) => (
              <div key={r.id} className="relative flex flex-col gap-4 rounded-lg border border-border bg-widget p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <RadioGroupItem
                      id={r.id.toString()}
                      value={r.id.toString()}
                      className="after:absolute after:inset-0"
                    />

                    <div className="grid grow gap-1">
                      <Label className="inline-flex items-start" htmlFor={r.id.toString()}>
                        {r.name}

                        {r.id === recipient.id && (
                          <span className="ms-2 text-muted-foreground">
                            <Trans>(You)</Trans>
                          </span>
                        )}
                      </Label>
                      <p className="text-muted-foreground text-xs">{r.email}</p>
                    </div>
                  </div>
                  <div className="text-muted-foreground text-xs leading-[inherit]">
                    <Plural
                      value={assistantFields.filter((field) => field.recipientId === r.id).length}
                      one="# field"
                      other="# fields"
                    />
                  </div>
                </div>
              </div>
            ))}
        </RadioGroup>
      </fieldset>
    );
  }

  return (
    <fieldset disabled={isSubmitting} className="flex flex-1 flex-col gap-4">
      <div className="flex flex-1 flex-col gap-y-4">
        <div>
          <Label htmlFor="full-name">
            <Trans>Full Name</Trans>
          </Label>

          <Input
            type="text"
            id="full-name"
            className="mt-2 bg-background"
            value={fullName}
            disabled={isNameLocked}
            onChange={(e) => !isNameLocked && setFullName(e.target.value.trimStart())}
          />
        </div>
      </div>
    </fieldset>
  );
}
