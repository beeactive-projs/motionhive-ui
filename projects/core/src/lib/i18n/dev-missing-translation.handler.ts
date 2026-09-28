import { Injectable, isDevMode } from '@angular/core';
import {
  MissingTranslationHandler,
  MissingTranslationHandlerParams,
} from '@ngx-translate/core';

/**
 * Shows the key itself (ngx-translate's default) and, in dev builds, warns once
 * per key — a typo'd or not-yet-added key is otherwise silent until someone
 * spots `clients.list.titel` on screen.
 */
@Injectable()
export class DevMissingTranslationHandler implements MissingTranslationHandler {
  private readonly _reported = new Set<string>();

  handle(params: MissingTranslationHandlerParams): string {
    if (isDevMode() && !this._reported.has(params.key)) {
      this._reported.add(params.key);
      console.warn(`[i18n] Missing translation: ${params.key}`);
    }
    return params.key;
  }
}
