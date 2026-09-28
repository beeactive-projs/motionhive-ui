import { DOCUMENT, registerLocaleData } from '@angular/common';
import localeEnGb from '@angular/common/locales/en-GB';
import localeRo from '@angular/common/locales/ro';
import {
  EnvironmentProviders,
  LOCALE_ID,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import {
  TranslateService,
  provideMissingTranslationHandler,
  provideTranslateCompiler,
  provideTranslateLoader,
  provideTranslateService,
} from '@ngx-translate/core';
import { TranslateMessageFormatCompiler } from 'ngx-translate-messageformat-compiler';
import { firstValueFrom, forkJoin } from 'rxjs';

import { DEFAULT_LANGUAGE } from '../constants/languages.const';
import { LANGUAGE_SYNC_ENABLED } from '../services/i18n/language.service';
import { appLanguage, appLocale } from './app-language';
import { DevMissingTranslationHandler } from './dev-missing-translation.handler';
import { MergedTranslateLoader } from './merged-translate.loader';
import { registerTranslator } from './translator';

/**
 * Runtime translations for the authenticated apps (web + mobile).
 *
 * - ICU MessageFormat syntax (`{name}`, `{count, plural, one {…} other {…}}`) —
 *   Romanian needs the one/few/other plural forms.
 * - `LOCALE_ID` follows the UI language, so DatePipe & co. localise with no
 *   template changes.
 * - Bootstrap waits for the language file, so `instant()` is safe anywhere
 *   after it (TS-built menus, the plain-function `translate()`).
 */
export function provideAppI18n(): EnvironmentProviders {
  registerLocaleData(localeEnGb);
  registerLocaleData(localeRo);

  const language = appLanguage();

  return makeEnvironmentProviders([
    provideTranslateService({
      loader: provideTranslateLoader(MergedTranslateLoader),
      compiler: provideTranslateCompiler(TranslateMessageFormatCompiler),
      missingTranslationHandler: provideMissingTranslationHandler(DevMissingTranslationHandler),
    }),
    { provide: LOCALE_ID, useValue: appLocale() },
    { provide: LANGUAGE_SYNC_ENABLED, useValue: true },
    provideAppInitializer(() => {
      const translateService = inject(TranslateService);
      inject(DOCUMENT).documentElement.lang = language;
      registerTranslator((key, params) => translateService.instant(key, params));
      // English is loaded alongside a non-English UI language, before first
      // render, so a key the translation lacks shows English — never the key.
      return firstValueFrom(
        forkJoin([
          translateService.setFallbackLang(DEFAULT_LANGUAGE),
          translateService.use(language),
        ]),
      ).catch((err: unknown) => {
        // A failed file load must not stop the app from booting; it renders
        // keys instead, which is recoverable, where a blank screen is not.
        console.error('[i18n] Could not load translations', err);
      });
    }),
  ]);
}
