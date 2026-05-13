import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { MessagingService, UserBlock } from 'core';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import {
  displayName,
  initialsOf,
} from '../../../messages/utils/participant';

/**
 * Profile → Safety tab.
 *
 * The user's blocked-users list. Each row shows the blocked person,
 * the reason chip (if any), the date, and an "Unblock" button. Empty
 * state explains what blocking does so the page works as discovery
 * for users who've never blocked anyone.
 *
 * The block list comes from `MessagingService.listBlocks()` which
 * eager-loads the `blocked` user snapshot. Unblock calls
 * `MessagingService.unblock(blockedId)` — on success we drop the row
 * locally so the unblock feels instant; on failure we re-load to
 * resync.
 *
 * Note: we don't reach into MessagingStore here. The store mirrors
 * "active inbox" state, not the user's safety preferences. Mixing
 * the two would couple the settings page to the inbox lifecycle
 * (which auto-disconnects from SSE on logout, drops caches, etc.).
 */
@Component({
  selector: 'mh-profile-safety',
  standalone: true,
  imports: [
    Button,
    CardModule,
    SkeletonModule,
    ToastModule,
    HexAvatar,
  ],
  providers: [MessageService],
  templateUrl: './safety.html',
  styleUrl: './safety.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileSafety implements OnInit {
  private readonly _messaging = inject(MessagingService);
  private readonly _messageService = inject(MessageService);

  protected readonly loading = signal(true);
  protected readonly blocks = signal<UserBlock[]>([]);
  /**
   * Per-row unblock-in-flight tracker. Lets us disable just the row
   * being acted on without locking the whole list.
   */
  protected readonly unblocking = signal<Set<string>>(new Set());

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this._messaging.listBlocks().subscribe({
      next: (rows) => {
        this.blocks.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this._messageService.add({
          severity: 'error',
          summary: 'Could not load blocked users',
          detail: 'Please try again.',
        });
      },
    });
  }

  unblock(row: UserBlock): void {
    const targetId = row.blockedId;
    if (this.unblocking().has(targetId)) return;

    // Mark this row as in-flight.
    this.unblocking.update((s) => new Set(s).add(targetId));

    this._messaging.unblock(targetId).subscribe({
      next: () => {
        // Drop the row locally — the BE has already removed the
        // user_block entry. We don't reload the whole list to keep
        // the action feeling immediate.
        this.blocks.update((list) =>
          list.filter((b) => b.blockedId !== targetId),
        );
        this.unblocking.update((s) => {
          const next = new Set(s);
          next.delete(targetId);
          return next;
        });
        this._messageService.add({
          severity: 'success',
          summary: 'Unblocked',
          detail: `${this.nameOf(row)} can message you again.`,
        });
      },
      error: () => {
        this.unblocking.update((s) => {
          const next = new Set(s);
          next.delete(targetId);
          return next;
        });
        this._messageService.add({
          severity: 'error',
          summary: 'Could not unblock',
          detail: 'Please try again.',
        });
        // Reload to resync — the row may have been removed BE-side
        // anyway (e.g. by the blocked user deleting their account).
        this.load();
      },
    });
  }

  protected isUnblocking(row: UserBlock): boolean {
    return this.unblocking().has(row.blockedId);
  }

  protected nameOf(row: UserBlock): string {
    return displayName(row.blocked, 'A blocked user');
  }

  protected initialsOf(row: UserBlock): string {
    return initialsOf(row.blocked);
  }

  protected reasonLabel(row: UserBlock): string | null {
    switch (row.reason) {
      case 'SPAM':
        return 'Spam';
      case 'HARASSMENT':
        return 'Harassment';
      case 'SCAM':
        return 'Scam';
      case 'IMPERSONATION':
        return 'Impersonation';
      case 'OTHER':
        return 'Other';
      default:
        return null;
    }
  }

  protected formattedDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}
