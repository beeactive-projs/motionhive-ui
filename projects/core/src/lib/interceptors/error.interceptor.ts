import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { translate } from '../i18n/translator';
import { HttpErrorInfo, ErrorDialogService } from '../services/error-dialog/error-dialog.service';
import { friendlyStatusMessage } from '../utils/api-error.utils';
import { isSilentRequest } from './silent-request.context';

// 401 is handled by the auth interceptor (token refresh / redirect to login).
// 400 and 422 are validation/business-logic errors — components show field-level errors.
// 429 is rate-limiting: a modal for "you typed too fast" is far too heavy;
//   callers that care surface a toast via `showApiError` (which knows 429
//   should read as "give it a moment"), and everything else stays silent.
const SKIP_STATUSES = new Set([400, 401, 422, 429]);

function mapError(error: HttpErrorResponse): HttpErrorInfo {
  const serverMessage = error.error?.message as string | undefined;
  const status = error.status;

  switch (status) {
    case 0:
      return { status, title: translate('error.dialog.noConnection'), message: friendlyStatusMessage(0)! };
    case 403:
      return {
        status,
        title: translate('error.dialog.accessDenied'),
        message: serverMessage ?? translate('error.http.forbidden'),
      };
    case 404:
      return {
        status,
        title: translate('error.dialog.notFound'),
        message: serverMessage ?? translate('error.http.notFound'),
      };
    case 409:
      return {
        status,
        title: translate('error.dialog.conflict'),
        message: serverMessage ?? translate('error.http.conflict'),
      };
    case 500:
    case 502:
    case 503:
    case 504:
      // A 5xx body is written for logs, not for the person reading the
      // dialog — "Internal server error" tells them nothing they can act on.
      return {
        status,
        title: translate('error.dialog.generic'),
        message: friendlyStatusMessage(status)!,
      };
    default:
      return {
        status,
        title: translate('error.dialog.generic'),
        message: serverMessage ?? translate('error.http.unexpected'),
      };
  }
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const errorDialogService = inject(ErrorDialogService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        !SKIP_STATUSES.has(error.status) &&
        // The caller opted to handle this error itself (e.g. search-modal
        // resolving a session that may have just run out) — no global dialog.
        !isSilentRequest(req.context) &&
        !router.url.startsWith('/auth') &&
        !router.url.startsWith('/error')
      ) {
        errorDialogService.show(mapError(error));
      }

      return throwError(() => error);
    }),
  );
};
