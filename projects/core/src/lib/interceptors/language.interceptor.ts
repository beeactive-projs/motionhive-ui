import { HttpInterceptorFn } from '@angular/common/http';
import { appLanguage } from '../i18n/app-language';
import { environment } from '../../environments/environment';

/**
 * Tells the API which language the app is showing, so the messages it
 * sends back (a refused action, a validation error) come in that
 * language. Only on API calls: third-party requests keep the browser's
 * own `Accept-Language`.
 */
export const languageInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) return next(req);
  return next(req.clone({ setHeaders: { 'Accept-Language': appLanguage() } }));
};
