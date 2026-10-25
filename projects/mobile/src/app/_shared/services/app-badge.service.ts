import { Service, effect, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Badge } from '@capawesome/capacitor-badge';
import { AuthStore, MessagingStore, NotificationStore } from 'core';

/**
 * Keeps the number on the app icon in step with what is unread.
 *
 * The server sets the number on every push, read at send time: unread
 * messages plus unread notifications. Nothing tells the phone when that
 * number goes down, so iOS keeps showing it after everything is read.
 * This is the other half: whenever the app is open and both counts are
 * known, it writes the same sum. Opening a chat, reading a notification
 * or coming back from the background all move the number.
 *
 * Waits for both counts to arrive from the server, so a cold start does
 * not flash the badge to 0 and back. On sign-out it clears, since the
 * number belongs to the account that left.
 */
@Service()
export class AppBadgeService {
  private readonly _authStore = inject(AuthStore);
  private readonly _messagingStore = inject(MessagingStore);
  private readonly _notificationStore = inject(NotificationStore);

  constructor() {
    if (!Capacitor.isNativePlatform()) return;

    effect(() => {
      if (!this._authStore.isAuthenticated()) {
        void this.write(0);
        return;
      }
      if (!this._messagingStore.hasLoaded() || !this._notificationStore.countLoaded()) return;
      void this.write(this._messagingStore.unreadTotal() + this._notificationStore.unreadCount());
    });
  }

  /** On iOS, 0 also clears delivered notifications, which is right once all is read. */
  private async write(count: number): Promise<void> {
    try {
      await Badge.set({ count });
    } catch {
      // No badge permission (push declined) or no launcher support. The
      // number is a convenience; nothing else depends on it.
    }
  }
}
