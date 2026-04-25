import type { MessageService } from 'primeng/api';

/**
 * Shape of HttpErrorResponse-like errors. The actual `HttpErrorResponse`
 * type is in `@angular/common/http` but we keep this loose so the helper
 * can be used from anywhere in the app, including services that hand
 * around a generic `unknown` from a `catchError`.
 */
interface MaybeApiError {
  error?: { message?: string } | null;
  message?: string;
}

/**
 * Best-effort extraction of a human-readable message from a backend
 * error. Prefers the BE's own `{ message }` payload (which is what
 * `HttpExceptionFilter` returns), falls back to the HTTP layer's
 * message, then to the provided fallback.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const e = err as MaybeApiError | null | undefined;
  return e?.error?.message ?? e?.message ?? fallback;
}

/**
 * Toast a backend error with a sensible default. Replaces the
 * 25+ copy-pasted `err.error?.message || 'Failed to X'` lines that
 * had grown across the codebase.
 *
 * @param messageService PrimeNG MessageService
 * @param summary Short header shown to the user (e.g. "Could not save venue")
 * @param fallback Body text used when the BE didn't ship a message
 * @param err The error object from the failing observable
 */
export function showApiError(
  messageService: MessageService,
  summary: string,
  fallback: string,
  err: unknown,
): void {
  messageService.add({
    severity: 'error',
    summary,
    detail: apiErrorMessage(err, fallback),
  });
}
