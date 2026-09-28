import { Pipe, PipeTransform } from '@angular/core';

import { languageName } from '../i18n/language-name';

/**
 * Language code → display name: `{{ profile.language | languageName }}` → "Română".
 *
 * Pure — the UI language is fixed for the page load.
 */
@Pipe({ name: 'languageName' })
export class LanguageNamePipe implements PipeTransform {
  transform(code: string | null | undefined): string {
    return languageName(code);
  }
}
