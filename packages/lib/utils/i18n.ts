import type { I18n, MessageDescriptor } from '@lingui/core';
import { i18n } from '@lingui/core';
import type { MacroMessageDescriptor } from '@lingui/core/macro';

import type { I18nLocaleData, SupportedLanguageCodes } from '../constants/i18n';
import { APP_I18N_OPTIONS } from '../constants/i18n';
import { env } from './env';

export async function getTranslations(locale: string) {
  const extension = env('NODE_ENV') === 'development' ? 'po' : 'mjs';

  const { messages } = await import(`../translations/${locale}/web.${extension}`);

  return messages;
}

export async function dynamicActivate(locale: string) {
  const messages = await getTranslations(locale);

  i18n.loadAndActivate({ locale, messages });
}

const parseLanguageFromLocale = (locale: string): SupportedLanguageCodes | null => {
  const [language, _country] = locale.split('-');

  const foundSupportedLanguage = APP_I18N_OPTIONS.supportedLangs.find(
    (lang): lang is SupportedLanguageCodes => lang === language,
  );

  if (!foundSupportedLanguage) {
    return null;
  }

  return foundSupportedLanguage;
};

/**
 * Extracts the language from the `accept-language` header.
 */
export const extractLocaleDataFromHeaders = (
  headers: Headers,
): { lang: SupportedLanguageCodes | null; locales: string[] } => {
  const headerLocales = (headers.get('accept-language') ?? '').split(',');

  const language = parseLanguageFromLocale(headerLocales[0]);

  return {
    lang: language,
    locales: [headerLocales[0]],
  };
};

type ExtractLocaleDataOptions = {
  headers: Headers;
};

/**
 * Resolve the language for a request that has no language cookie.
 *
 * This instance always defaults to `APP_I18N_OPTIONS.defaultLang` (Hebrew), regardless
 * of the browser's `accept-language` header. Users can still switch language, which sets the cookie.
 */
export const extractLocaleData = ({ headers }: ExtractLocaleDataOptions): I18nLocaleData => {
  const headerLocales = (headers.get('accept-language') ?? '').split(',');

  return {
    lang: APP_I18N_OPTIONS.defaultLang,
    locales: headerLocales,
  };
};

export const parseMessageDescriptor = (_: I18n['_'], value: string | MessageDescriptor) => {
  return typeof value === 'string' ? value : _(value);
};

export const parseMessageDescriptorMacro = (
  t: (descriptor: MacroMessageDescriptor) => string,
  value: string | MessageDescriptor,
) => {
  return typeof value === 'string' ? value : t(value);
};
