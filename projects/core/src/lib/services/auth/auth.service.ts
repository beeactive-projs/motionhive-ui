import { Injectable, inject, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, BehaviorSubject, tap, Subscription, switchMap } from 'rxjs';
import { LoginRequest } from '../../models/auth/login.model';
import { RegisterRequest } from '../../models/auth/register.model';
import { GoogleLoginRequest, FacebookLoginRequest } from '../../models/auth/social-login.model';
import { AuthResponse } from '../../models/auth/auth-response.model';
import {
  ForgotPasswordRequest,
  ResetPasswordRequest,
  PasswordResetResponse,
} from '../../models/auth/password-reset.model';
import { User } from '../../models/user/user.model';
import { UserRole } from '../../models/user/role.model';
import { TokenService } from './token.service';
import { AuthStore } from '../../stores/auth.store';
import { API_ENDPOINTS } from '../../constants/api-endpoints.const';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService implements OnDestroy {
  private readonly _http = inject(HttpClient);
  private readonly _router = inject(Router);
  private readonly _tokenService = inject(TokenService);
  private readonly _authStore = inject(AuthStore);

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  private refreshTimerId: ReturnType<typeof setTimeout> | null = null;
  private refreshSubscription: Subscription | null = null;

  constructor() {
    this.checkAuthStatus();
  }

  ngOnDestroy(): void {
    this.clearRefreshTimer();
  }

  private checkAuthStatus(): void {
    const token = this._tokenService.getAccessToken();
    const user = this._tokenService.getUser();

    if (token && user) {
      this.currentUserSubject.next(user);
      this.isAuthenticatedSubject.next(true);
      this._authStore.setUser(user);
      this.scheduleTokenRefresh(token);

      this.fetchAndStoreProfile().subscribe();
    }
  }

  login(credentials: LoginRequest): Observable<User> {
    return this._http
      .post<AuthResponse>(`${environment.apiUrl}${API_ENDPOINTS.AUTH.LOGIN}`, credentials)
      .pipe(
        tap((response) => this.handleAuthResponse(response)),
        switchMap(() => this.fetchAndStoreProfile()),
      );
  }

  register(data: RegisterRequest): Observable<User> {
    return this._http
      .post<AuthResponse>(`${environment.apiUrl}${API_ENDPOINTS.AUTH.REGISTER}`, data)
      .pipe(
        tap((response) => this.handleAuthResponse(response)),
        switchMap(() => this.fetchAndStoreProfile()),
      );
  }

  logout(): Observable<void> {
    this.clearAuthData();
    return new Observable<void>();
    // return this._http
    //   .post<void>(`${environment.apiUrl}${API_ENDPOINTS.AUTH.LOGOUT}`, {})
    //   .pipe(tap(() => this.clearAuthData()));
  }

  googleLogin(request: GoogleLoginRequest): Observable<User> {
    return this._http
      .post<AuthResponse>(`${environment.apiUrl}${API_ENDPOINTS.AUTH.GOOGLE}`, request)
      .pipe(
        tap((response) => this.handleAuthResponse(response)),
        switchMap(() => this.fetchAndStoreProfile()),
      );
  }

  facebookLogin(request: FacebookLoginRequest): Observable<User> {
    return this._http
      .post<AuthResponse>(`${environment.apiUrl}${API_ENDPOINTS.AUTH.FACEBOOK}`, request)
      .pipe(
        tap((response) => this.handleAuthResponse(response)),
        switchMap(() => this.fetchAndStoreProfile()),
      );
  }

  refreshToken(): Observable<{ accessToken: string }> {
    const refreshToken = this._tokenService.getRefreshToken();
    return this._http
      .post<{ accessToken: string }>(`${environment.apiUrl}${API_ENDPOINTS.AUTH.REFRESH}`, {
        refreshToken,
      })
      .pipe(
        tap((response) => {
          this._tokenService.setAccessToken(response.accessToken);
          this.scheduleTokenRefresh(response.accessToken);
        }),
      );
  }

  forgotPassword(data: ForgotPasswordRequest): Observable<PasswordResetResponse> {
    return this._http.post<PasswordResetResponse>(
      `${environment.apiUrl}${API_ENDPOINTS.AUTH.FORGOT_PASSWORD}`,
      data,
    );
  }

  resetPassword(data: ResetPasswordRequest): Observable<PasswordResetResponse> {
    return this._http.post<PasswordResetResponse>(
      `${environment.apiUrl}${API_ENDPOINTS.AUTH.RESET_PASSWORD}`,
      data,
    );
  }

  clearAuthDataAndRedirect(): void {
    this.clearAuthData();
    this._router.navigate(['/auth/login']);
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  hasRole(role: UserRole): boolean {
    const roles = this._tokenService.getRoles();
    return roles.includes(role);
  }

  hasPermission(permission: string): boolean {
    const permissions = this._tokenService.getPermissions();
    return permissions.includes(permission);
  }

  private fetchAndStoreProfile(): Observable<User> {
    return this._http.get<User>(`${environment.apiUrl}${API_ENDPOINTS.USERS.ME}`).pipe(
      tap((user) => {
        this._tokenService.setUser(user);
        this.currentUserSubject.next(user);
        this._authStore.setUser(user);
      }),
    );
  }

  private handleAuthResponse(response: AuthResponse): void {
    this._tokenService.setAccessToken(response.accessToken);
    this._tokenService.setRefreshToken(response.refreshToken);
    this._tokenService.setUser(response.user);
    this._tokenService.setRoles(response.roles);
    this._tokenService.setPermissions(response.permissions);

    this.currentUserSubject.next(response.user);
    this.isAuthenticatedSubject.next(true);
    this._authStore.setUser(response.user);

    this.scheduleTokenRefresh(response.accessToken);
  }

  private clearAuthData(): void {
    this.clearRefreshTimer();
    this._tokenService.clearTokens();
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this._authStore.clearUser();
  }

  private scheduleTokenRefresh(accessToken: string): void {
    this.clearRefreshTimer();

    const expiresInMs = this.getTokenExpiresInMs(accessToken);
    if (expiresInMs <= 0) return;

    // Refresh 60 seconds before expiry (or at half-life if token lives < 2 min)
    const refreshInMs = expiresInMs > 120_000 ? expiresInMs - 60_000 : expiresInMs / 2;

    this.refreshTimerId = setTimeout(() => {
      this.refreshSubscription = this.refreshToken().subscribe({
        error: () => this.clearAuthDataAndRedirect(),
      });
    }, refreshInMs);
  }

  private getTokenExpiresInMs(token: string): number {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiresAt = payload.exp * 1000;
      return expiresAt - Date.now();
    } catch {
      return 0;
    }
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimerId) {
      clearTimeout(this.refreshTimerId);
      this.refreshTimerId = null;
    }
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
      this.refreshSubscription = null;
    }
  }
}
