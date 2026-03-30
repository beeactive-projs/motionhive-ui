import { Injectable, signal, computed, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'mh-active-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this._platformId);

  readonly theme = signal<Theme>(this.getInitialTheme());

  readonly isDark = computed(() => this.theme() === 'dark');

  constructor() {
    effect(() => {
      const current = this.theme();
      if (this.isBrowser) {
        const root = document.documentElement;
        root.classList.toggle('dark', current === 'dark');
        localStorage.setItem(STORAGE_KEY, current);
      }
    });
  }

  toggle(): void {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  private getInitialTheme(): Theme {
    if (!this.isBrowser) {
      return 'light';
    }

    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }

    return 'dark';
  }
}
