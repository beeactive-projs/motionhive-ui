import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { HttpErrorInfo, ErrorDialogService } from '../services/error-dialog/error-dialog.service';

// 401 is handled by the auth interceptor (token refresh / redirect to login).
// 400 and 422 are validation/business-logic errors — components show field-level errors.
const SKIP_STATUSES = new Set([400, 401, 422]);

function mapError(error: HttpErrorResponse): HttpErrorInfo {
  const serverMessage = error.error?.message as string | undefined;

  switch (error.status) {
    case 0:
      return {
        status: 0,
        title: 'Connection Error',
        message: 'Unable to reach the server. Please check your internet connection and try again.',
      };
    case 403:
      return {
        status: 403,
        title: 'Access Denied',
        message: serverMessage ?? 'You do not have permission to perform this action.',
      };
    case 404:
      return {
        status: 404,
        title: 'Not Found',
        message: serverMessage ?? 'The requested resource could not be found.',
      };
    case 409:
      return {
        status: 409,
        title: 'Conflict',
        message: serverMessage ?? 'This action could not be completed due to a conflict.',
      };
    case 500:
      return {
        status: 500,
        title: 'Server Error',
        message: serverMessage ?? 'An unexpected error occurred on our end. Please try again later.',
      };
    case 502:
    case 503:
    case 504:
      return {
        status: error.status,
        title: 'Service Unavailable',
        message: 'The service is temporarily unavailable. Please try again in a moment.',
      };
    default:
      return {
        status: error.status,
        title: 'Something Went Wrong',
        message: serverMessage ?? 'An unexpected error occurred. Please try again.',
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
        !router.url.startsWith('/auth') &&
        !router.url.startsWith('/error')
      ) {
        errorDialogService.show(mapError(error));
      }

      return throwError(() => error);
    }),
  );
};
