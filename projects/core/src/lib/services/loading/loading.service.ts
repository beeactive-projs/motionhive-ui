import { computed, Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly _activeRequests = signal(0);

  readonly pageLoading = signal(false);
  readonly requestLoading = computed(() => this._activeRequests() > 0);

  startPageLoad(): void {
    this.pageLoading.set(true);
  }

  stopPageLoad(): void {
    this.pageLoading.set(false);
  }

  increment(): void {
    this._activeRequests.update((n) => n + 1);
  }

  decrement(): void {
    this._activeRequests.update((n) => Math.max(0, n - 1));
  }
}
