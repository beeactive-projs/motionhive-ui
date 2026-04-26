import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { TokenService } from '../services/auth/token.service';
import { AuthService } from '../services/auth/auth.service';
import { API_ENDPOINTS } from '../constants/api-endpoints.const';
import { environment } from '../../environments/environment';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

const SKIP_AUTH_PATHS = [
  API_ENDPOINTS.AUTH.LOGIN,
  API_ENDPOINTS.AUTH.REGISTER,
  API_ENDPOINTS.AUTH.REFRESH,
  API_ENDPOINTS.AUTH.FORGOT_PASSWORD,
  API_ENDPOINTS.AUTH.RESET_PASSWORD,
];

function shouldSkipAuth(url: string): boolean {
  if (!url.startsWith(environment.apiUrl)) return true;
  return SKIP_AUTH_PATHS.some((path) => url.includes(path));
}

function addAuthHeader(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenService = inject(TokenService);
  const injector = inject(Injector);

  if (shouldSkipAuth(req.url)) {
    return next(req);
  }

  const token = tokenService.getAccessToken();
  const authReq = token ? addAuthHeader(req, token) : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !shouldSkipAuth(req.url)) {
        const authService = injector.get(AuthService);
        return handleTokenRefresh(req, next, authService, tokenService);
      }
      return throwError(() => error);
    }),
  );
};

function handleTokenRefresh(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
  tokenService: TokenService,
) {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    return authService.refreshToken().pipe(
      switchMap((response) => {
        isRefreshing = false;
        refreshTokenSubject.next(response.accessToken);
        return next(addAuthHeader(req, response.accessToken));
      }),
      catchError((err) => {
        isRefreshing = false;
        authService.clearAuthDataAndRedirect();
        return throwError(() => err);
      }),
    );
  }

  // Queue requests while a refresh is in progress
  return refreshTokenSubject.pipe(
    filter((token) => token !== null),
    take(1),
    switchMap((token) => next(addAuthHeader(req, token))),
  );
}
