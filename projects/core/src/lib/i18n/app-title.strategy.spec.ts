import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppTitleStrategy } from './app-title.strategy';

// The core test setup registers the real English shared translations, so
// `common.pageTitle` / `common.appName` resolve; app keys (`pageTitle.*`) don't.
describe('AppTitleStrategy', () => {
  const setTitle = vi.fn();
  let strategy: AppTitleStrategy;

  beforeEach(() => {
    setTitle.mockReset();
    TestBed.configureTestingModule({
      providers: [AppTitleStrategy, { provide: Title, useValue: { setTitle } }],
    });
    strategy = TestBed.inject(AppTitleStrategy);
  });

  function updateWith(title: string | undefined): void {
    vi.spyOn(strategy, 'buildTitle').mockReturnValue(title);
    strategy.updateTitle({} as RouterStateSnapshot);
  }

  it('formats a translated key as "<page> · MotionHive"', () => {
    updateWith('nav.clients');
    expect(setTitle).toHaveBeenCalledWith('Clients · MotionHive');
  });

  it('shows a plain-text title as written', () => {
    updateWith('Legacy page');
    expect(setTitle).toHaveBeenCalledWith('Legacy page · MotionHive');
  });

  it('shows the app name for a route with no title', () => {
    updateWith(undefined);
    expect(setTitle).toHaveBeenCalledWith('MotionHive');
  });
});
