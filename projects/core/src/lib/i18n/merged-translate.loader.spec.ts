import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MergedTranslateLoader } from './merged-translate.loader';

describe('MergedTranslateLoader', () => {
  let http: HttpTestingController;
  let loader: MergedTranslateLoader;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), MergedTranslateLoader],
    });
    http = TestBed.inject(HttpTestingController);
    loader = TestBed.inject(MergedTranslateLoader);
  });

  afterEach(() => http.verify());

  it("merges the shared file with the app's own", async () => {
    const result = firstValueFrom(loader.getTranslation('ro'));

    http.expectOne('i18n/shared/ro.json').flush({ button: { save: 'Salvează' } });
    http.expectOne('i18n/ro.json').flush({ clients: { title: 'Clienți' } });

    expect(await result).toEqual({
      button: { save: 'Salvează' },
      clients: { title: 'Clienți' },
    });
  });
});
