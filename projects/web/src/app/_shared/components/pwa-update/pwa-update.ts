import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, interval } from 'rxjs';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { Button } from 'primeng/button';

/**
 * Listens for a newly deployed app version (downloaded in the background by the
 * service worker) and prompts the user to reload. Owns its own MessageService so
 * it never collides with feature-level toasts; the scoped `key` isolates its toast.
 */
@Component({
  selector: 'mh-pwa-update',
  imports: [Toast, Button],
  templateUrl: './pwa-update.html',
  styleUrl: './pwa-update.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
})
export class PwaUpdate {
  protected readonly toastKey = 'pwa-update';

  private readonly _swUpdate = inject(SwUpdate);
  private readonly _messageService = inject(MessageService);
  private readonly _document = inject(DOCUMENT);
  private readonly _destroyRef = inject(DestroyRef);

  private static readonly CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

  constructor() {
    if (!this._swUpdate.isEnabled) {
      return;
    }

    this._swUpdate.versionUpdates
      .pipe(
        filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe(() => this._promptReload());

    // Poll for a new deployed version while the tab stays open.
    interval(PwaUpdate.CHECK_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => this._swUpdate.checkForUpdate().catch(() => undefined));
  }

  reload(): void {
    this._document.location.reload();
  }

  private _promptReload(): void {
    this._messageService.add({
      key: this.toastKey,
      severity: 'info',
      summary: 'Update available',
      detail: 'A new version of MotionHive is ready.',
      sticky: true,
      closable: true,
    });
  }
}
