import { shouldUseSecureCookies } from '@documenso/lib/constants/auth';
import { createCookie } from 'react-router';

// Renamed from `lang` so visitors whose English default was saved before Hebrew became the default get Hebrew.
export const langCookie = createCookie('lang_v2', {
  path: '/',
  maxAge: 60 * 60 * 24 * 365 * 2,
  httpOnly: true,
  secure: shouldUseSecureCookies(),
});
