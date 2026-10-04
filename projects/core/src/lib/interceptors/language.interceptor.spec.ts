import { describe, expect, it } from 'vitest';
import { HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { of } from 'rxjs';
import { languageInterceptor } from './language.interceptor';
import { environment } from '../../environments/environment';
import { appLanguage } from '../i18n/app-language';

function send(url: string): HttpRequest<unknown> {
  let sent: HttpRequest<unknown> | undefined;
  const next: HttpHandlerFn = (req) => {
    sent = req;
    return of();
  };
  languageInterceptor(new HttpRequest('GET', url), next).subscribe();
  return sent!;
}

describe('languageInterceptor', () => {
  it('sends the app language to the API', () => {
    expect(send(`${environment.apiUrl}/notifications`).headers.get('Accept-Language')).toBe(
      appLanguage(),
    );
  });

  it('leaves other hosts alone', () => {
    expect(send('https://example.com/x').headers.has('Accept-Language')).toBe(false);
  });
});
