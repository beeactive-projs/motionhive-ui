import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Service, inject, signal } from '@angular/core';

/**
 * Marks a full page load we started ourselves (e.g. switching to the other
 * language's site), so the top progress bar shows while the browser fetches
 * the next document instead of the page looking frozen.
 */
@Service()
export class PageLoadService {
  readonly isLoading = signal(false);

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    // Back/forward cache restores this page as it was left, bar included.
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) this.isLoading.set(false);
    });
  }

  start(): void {
    this.isLoading.set(true);
  }
}
