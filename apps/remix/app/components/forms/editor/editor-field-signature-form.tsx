import { DEFAULT_SIGNATURE_TEXT_FONT_SIZE } from '@documenso/lib/constants/pdf';
import {
  FIELD_SIGNATURE_META_DEFAULT_VALUES,
  type TSignatureFieldMeta,
  type TSignatureFieldType,
  ZSignatureFieldMeta,
  ZSignatureFieldType,
} from '@documenso/lib/types/field-meta';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import { Form, FormField, FormItem, FormLabel } from '@documenso/ui/primitives/form/form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { EditorGenericFontSizeField, EditorGenericLabelField } from './editor-field-generic-field-forms';

const ZSignatureFieldFormSchema = ZSignatureFieldMeta.pick({
  label: true,
  fontSize: true,
  overflow: true,
}).extend({
  // An empty list means the field uses the document's signature settings.
  signatureTypes: z.array(ZSignatureFieldType).optional(),
});

type TSignatureFieldFormSchema = z.infer<typeof ZSignatureFieldFormSchema>;

const SIGNATURE_TYPE_OPTIONS = [
  { value: 'draw', label: msg({ message: `Draw`, context: `Draw signature` }) },
  { value: 'type', label: msg({ message: `Type`, context: `Type signature` }) },
  { value: 'upload', label: msg({ message: `Upload`, context: `Upload signature` }) },
] satisfies { value: TSignatureFieldType; label: MessageDescriptor }[];

type EditorFieldSignatureFormProps = {
  value: z.input<typeof ZSignatureFieldMeta> | undefined;
  onValueChange: (value: TSignatureFieldMeta) => void;
};

export const EditorFieldSignatureForm = ({
  value = {
    type: 'signature',
  },
  onValueChange,
}: EditorFieldSignatureFormProps) => {
  const { _ } = useLingui();

  const form = useForm<TSignatureFieldFormSchema>({
    resolver: zodResolver(ZSignatureFieldFormSchema),
    mode: 'onChange',
    defaultValues: {
      label: value.label || '',
      overflow: value.overflow || FIELD_SIGNATURE_META_DEFAULT_VALUES.overflow,
      fontSize: value.fontSize || DEFAULT_SIGNATURE_TEXT_FONT_SIZE,
      signatureTypes: value.signatureTypes ?? [],
    },
  });

  const { control } = form;

  const formValues = useWatch({
    control,
  });

  // Dupecode/Inefficient: Done because native isValid won't work for our usecase.
  useEffect(() => {
    const validatedFormValues = ZSignatureFieldFormSchema.safeParse(formValues);

    if (validatedFormValues.success) {
      const { label, signatureTypes, ...rest } = validatedFormValues.data;

      onValueChange({
        ...value,
        type: 'signature',
        ...rest,
        label: label || undefined,
        signatureTypes: signatureTypes?.length ? signatureTypes : undefined,
      });
    }
  }, [formValues]);

  return (
    <Form {...form}>
      <form>
        <fieldset className="flex flex-col gap-4">
          <div>
            <EditorGenericLabelField formControl={form.control} />
            <p className="mt-0.5 text-muted-foreground text-xs">
              <Trans>Shown on the field and in the signing dialog, e.g. "Company stamp"</Trans>
            </p>
          </div>

          <FormField
            control={form.control}
            name="signatureTypes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Allowed signature types</Trans>
                </FormLabel>

                <div className="flex flex-col gap-2">
                  {SIGNATURE_TYPE_OPTIONS.map((option) => {
                    const selected = field.value ?? [];
                    const id = `field-signature-type-${option.value}`;

                    return (
                      <div key={option.value} className="flex items-center gap-2">
                        <Checkbox
                          id={id}
                          data-testid={id}
                          checked={selected.includes(option.value)}
                          onCheckedChange={(checked) =>
                            field.onChange(
                              checked
                                ? [...selected.filter((v) => v !== option.value), option.value]
                                : selected.filter((v) => v !== option.value),
                            )
                          }
                        />
                        <label className="text-muted-foreground text-sm" htmlFor={id}>
                          {_(option.label)}
                        </label>
                      </div>
                    );
                  })}
                </div>

                <p className="mt-0.5 text-muted-foreground text-xs">
                  <Trans>
                    Leave all unchecked to use the document settings. Select only Upload for a company stamp.
                  </Trans>
                </p>
              </FormItem>
            )}
          />

          <div>
            <EditorGenericFontSizeField formControl={form.control} />
            <p className="mt-0.5 text-muted-foreground text-xs">
              <Trans>The typed signature font size</Trans>
            </p>
          </div>
        </fieldset>
      </form>
    </Form>
  );
};
