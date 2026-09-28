import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { STORAGE_KEYS } from '../../constants/storage-keys.const';
import { AppLanguage } from '../../models/common/language.enums';
import { User } from '../../models/user/user.model';
import { AuthStore } from '../../stores/auth.store';
import { UserService } from '../user/user.service';
import { LANGUAGE_SYNC_ENABLED, LanguageService } from './language.service';

describe('LanguageService', () => {
  const reload = vi.fn();
  const updateMyLanguage = vi.fn();
  const routerEvents = new Subject<unknown>();
  let routerUrl = '/home';
  let authenticated = true;

  function setup(syncEnabled = true): LanguageService {
    TestBed.configureTestingModule({
      providers: [
        { provide: LANGUAGE_SYNC_ENABLED, useValue: syncEnabled },
        { provide: DOCUMENT, useValue: { defaultView: { location: { reload } } } },
        { provide: Router, useValue: { get url() { return routerUrl; }, events: routerEvents } },
        { provide: AuthStore, useValue: { isAuthenticated: () => authenticated } },
        { provide: UserService, useValue: { updateMyLanguage } },
      ],
    });
    return TestBed.inject(LanguageService);
  }

  const user = (language: string | null) => ({ language }) as User;
  const other = (lang: AppLanguage): AppLanguage => (lang === 'en' ? 'ro' : 'en');

  beforeEach(() => {
    routerUrl = '/home';
    authenticated = true;
    updateMyLanguage.mockReturnValue(of({}));
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('syncFromUser', () => {
    it('does nothing in an app without runtime translations', () => {
      const service = setup(false);
      service.syncFromUser(user(other(service.current)));
      expect(reload).not.toHaveBeenCalled();
      expect(updateMyLanguage).not.toHaveBeenCalled();
    });

    it("adopts the account's language — how a choice from another device arrives", () => {
      const service = setup();
      const accountLanguage = other(service.current);
      service.syncFromUser(user(accountLanguage));
      expect(localStorage.getItem(STORAGE_KEYS.LANGUAGE)).toBe(accountLanguage);
      expect(reload).toHaveBeenCalledOnce();
    });

    it('gives an account with no language the device one', () => {
      const service = setup();
      service.syncFromUser(user(null));
      expect(updateMyLanguage).toHaveBeenCalledWith(service.current);
      expect(reload).not.toHaveBeenCalled();
    });

    it('keeps a device choice the account never received, and retries saving it', () => {
      localStorage.setItem(STORAGE_KEYS.LANGUAGE_PENDING_SYNC, '1');
      const service = setup();
      service.syncFromUser(user(other(service.current)));
      expect(updateMyLanguage).toHaveBeenCalledWith(service.current);
      expect(reload).not.toHaveBeenCalled();
      expect(localStorage.getItem(STORAGE_KEYS.LANGUAGE_PENDING_SYNC)).toBeNull();
    });

    it('waits until sign-in has left /auth before reloading', () => {
      routerUrl = '/auth/login';
      const service = setup();
      service.syncFromUser(user(other(service.current)));
      expect(reload).not.toHaveBeenCalled();

      routerEvents.next(new NavigationEnd(1, '/auth/login', '/auth/login'));
      expect(reload).not.toHaveBeenCalled();
      routerEvents.next(new NavigationEnd(2, '/home', '/home'));
      expect(reload).toHaveBeenCalledOnce();
    });
  });

  describe('use', () => {
    it('stores the choice, saves it to the account, then reloads', () => {
      const service = setup();
      const next = other(service.current);
      service.use(next);
      expect(localStorage.getItem(STORAGE_KEYS.LANGUAGE)).toBe(next);
      expect(updateMyLanguage).toHaveBeenCalledWith(next);
      expect(localStorage.getItem(STORAGE_KEYS.LANGUAGE_PENDING_SYNC)).toBeNull();
      expect(reload).toHaveBeenCalledOnce();
    });

    it('still switches when the account save fails, and marks it for retry', () => {
      updateMyLanguage.mockReturnValue(throwError(() => new Error('offline')));
      const service = setup();
      service.use(other(service.current));
      expect(localStorage.getItem(STORAGE_KEYS.LANGUAGE_PENDING_SYNC)).toBe('1');
      expect(reload).toHaveBeenCalledOnce();
    });

    it('skips the account when signed out', () => {
      authenticated = false;
      const service = setup();
      service.use(other(service.current));
      expect(updateMyLanguage).not.toHaveBeenCalled();
      expect(reload).toHaveBeenCalledOnce();
    });

    it('ignores picking the current language', () => {
      const service = setup();
      service.use(service.current);
      expect(reload).not.toHaveBeenCalled();
    });
  });
});
