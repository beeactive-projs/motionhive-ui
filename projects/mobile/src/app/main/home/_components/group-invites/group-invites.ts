import { Component, DestroyRef, computed, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs';

import { AuthStore, GroupService, GroupsRefreshService, PendingGroupInvitation } from 'core';

import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { GroupInviteCard } from '../../../groups/_components/group-invite-card/group-invite-card';
import { hiddenInvitesKey, parseHiddenInvites } from '../../home.config';

/**
 * A group invitation on trainee Home (design 2026-11-14): the newest one the
 * reader has not put away, one card at most, so Home stays calm.
 *
 * "Not now" only puts it away here, on this device: the invitation stays
 * open and still waits on Groups home, and the coach is not told. Join
 * answers it, and `joined` lets Home reload Your hive, where the group now is.
 */
@Component({
  selector: 'mh-group-invites',
  imports: [GroupInviteCard],
  template: `
    @if (shown(); as invitation) {
      <mh-group-invite-card
        [invitation]="invitation"
        [answering]="answering()"
        (join)="join(invitation)"
        (later)="hide(invitation)"
      />
    }
  `,
  styles: `
    :host {
      display: block;
    }
    /* No box while there is nothing to show, so Home keeps its rhythm. */
    :host:not(:has(> mh-group-invite-card)) {
      display: none;
    }
  `,
})
export class GroupInvites {
  private readonly _authStore = inject(AuthStore);
  private readonly _groupService = inject(GroupService);
  private readonly _groupsRefresh = inject(GroupsRefreshService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);
  private readonly _destroyRef = inject(DestroyRef);

  readonly joined = output<string>();

  private readonly _invitations = signal<PendingGroupInvitation[]>([]);
  private readonly _hidden = signal<ReadonlySet<string>>(new Set());
  readonly answering = signal<'join' | 'later' | null>(null);

  /** The newest invitation not put away. */
  readonly shown = computed(() => {
    const hidden = this._hidden();
    const rows = this._invitations().filter((row) => !hidden.has(row.id));
    if (rows.length === 0) {
      return null;
    }
    return rows[0];
  });

  constructor() {
    this._hidden.set(new Set(this._readHidden()));
    this.reload();
  }

  /** Home calls this when it is shown again or pulled to refresh. */
  reload(): void {
    this._groupService
      .getMyInvitations()
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (page) => this._invitations.set(page.items),
        error: () => undefined,
      });
  }

  join(invitation: PendingGroupInvitation): void {
    if (this.answering()) {
      return;
    }
    this.answering.set('join');
    this._groupService
      .acceptInvitation(invitation.id)
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (result) => {
          this.answering.set(null);
          this._invitations.update((rows) => rows.filter((row) => row.id !== invitation.id));
          this._groupsRefresh.notify();
          void this._feedbackService.success(
            this._translateService.instant('groups.invite.toast.joined', {
              group: invitation.group.name,
            }),
          );
          this.joined.emit(result.groupId);
        },
        error: (error: unknown) => {
          this.answering.set(null);
          void this._feedbackService.error(
            error,
            this._translateService.instant('groups.invite.toast.joinFailed'),
          );
        },
      });
  }

  /** "Not now": off Home on this device; Groups still has it. */
  hide(invitation: PendingGroupInvitation): void {
    const next = new Set(this._hidden());
    next.add(invitation.id);
    this._hidden.set(next);
    try {
      localStorage.setItem(hiddenInvitesKey(this._userId()), JSON.stringify([...next]));
    } catch {
      // Blocked storage: it stays away until Home reloads.
    }
  }

  private _readHidden(): string[] {
    try {
      return parseHiddenInvites(localStorage.getItem(hiddenInvitesKey(this._userId())));
    } catch {
      return [];
    }
  }

  private _userId(): string {
    const user = this._authStore.user();
    if (!user) {
      return '';
    }
    return user.id;
  }
}
