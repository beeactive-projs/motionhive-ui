import type { MessageService } from 'primeng/api';

/**
 * Shape of HttpErrorResponse-like errors. The actual `HttpErrorResponse`
 * type is in `@angular/common/http` but we keep this loose so the helper
 * can be used from anywhere in the app, including services that hand
 * around a generic `unknown` from a `catchError`.
 */
interface MaybeApiError {
  error?: { message?: string | string[] } | null;
  message?: string;
  status?: number;
}

/**
 * Statuses whose server message is not written for a person. A 429 comes
 * back as "ThrottlerException: Too Many Requests" and a 5xx as whatever
 * blew up; both used to land in a toast verbatim. For these the copy is
 * ours. Every 4xx from validation and business rules keeps the BE's own
 * message, which IS written for a person.
 */
const FRIENDLY_BY_STATUS: Record<number, string> = {
  0: 'You seem to be offline. Check your connection and try again.',
  429: 'Too many requests at once — give it a moment and try again.',
  500: 'Something went wrong on our side. Please try again.',
  502: 'Something went wrong on our side. Please try again.',
  503: 'Something went wrong on our side. Please try again.',
  504: 'The server took too long to respond. Please try again.',
};

/**
 * Best-effort extraction of a human-readable message from a backend
 * error. Prefers the BE's own `{ message }` payload (which is what
 * `HttpExceptionFilter` returns) for the statuses where that message is
 * meant for a user; substitutes plain copy for the ones where it is not;
 * then falls back to the caller's text.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const e = err as MaybeApiError | null | undefined;
  const status = e?.status;

  if (status !== undefined && status in FRIENDLY_BY_STATUS) {
    return FRIENDLY_BY_STATUS[status];
  }

  // class-validator returns an array of messages; show the first, which is
  // the one about the field the user most likely just touched.
  const raw = e?.error?.message;
  const fromBody = Array.isArray(raw) ? raw[0] : raw;
  if (fromBody) return fromBody;

  // The HTTP layer's own text ("Http failure response for …: 0 Unknown
  // Error") is never worth showing; prefer the fallback the caller wrote.
  return fallback;
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
  const status = (err as MaybeApiError | null | undefined)?.status;
  // 429 is a hiccup, not a failure — read it as a warn so the toast
  // doesn't paint the red "something broke" you'd use for a 500.
  const severity: 'error' | 'warn' = status === 429 ? 'warn' : 'error';
  messageService.add({
    severity,
    summary: status === 429 ? 'Slow down a moment' : summary,
    detail: apiErrorMessage(err, fallback),
  });
}
