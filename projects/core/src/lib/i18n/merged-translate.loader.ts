import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { Observable, forkJoin, map } from 'rxjs';

/**
 * Loads one language as two files and merges them:
 *
 *   i18n/shared/<lang>.json — generic namespaces owned by core (`button`,
 *                             `validation`, `enum`, …), copied into every app
 *   i18n/<lang>.json        — the app's own feature namespaces
 *
 * The files split on top-level namespace, which `npm run i18n:check` keeps
 * disjoint, so a shallow merge is enough.
 *
 * Goes through `HttpBackend`, not the app's `HttpClient`: the auth/loading/
 * error interceptors are for API calls, and a static asset request must not
 * flash the global spinner or open the error dialog.
 */
@Injectable()
export class MergedTranslateLoader implements TranslateLoader {
  private readonly _http = new HttpClient(inject(HttpBackend));

  getTranslation(lang: string): Observable<TranslationObject> {
    return forkJoin([
      this._http.get<TranslationObject>(`i18n/shared/${lang}.json`),
      this._http.get<TranslationObject>(`i18n/${lang}.json`),
    ]).pipe(map(([shared, app]) => ({ ...shared, ...app })));
  }
}
