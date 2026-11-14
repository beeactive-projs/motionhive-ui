import { Component, DestroyRef, computed, inject, input, model, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  IonButton,
  IonCheckbox,
  IonItem,
  IonLabel,
  IonList,
  IonSearchbar,
  IonSkeletonText,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin, take } from 'rxjs';

import {
  ClientService,
  GroupService,
  InstructorClient,
  InstructorClientStatuses,
  clientDisplayName,
} from 'core';

import { EmptyState } from '../../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { SearchbarLabelDirective } from '../../../../_shared/directives/searchbar-label.directive';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';

/**
 * Invite people, from a group's ⋯: the group's invite link (a coach owner's,
 * for anyone who is not a client), then the owner's clients who are not in
 * yet, to tick and invite. Each one gets an invite in the app and joins only
 * if they accept (design 2026-11-14), so nobody lands in a group unasked.
 *
 * Opening the link sheet reports `link` once this sheet has gone, so the
 * parent never stacks one sheet on another.
 */
@Component({
  selector: 'mh-invite-people-sheet',
  imports: [
    EmptyState,
    HexAvatar,
    IonButton,
    IonCheckbox,
    IonItem,
    IonLabel,
    IonList,
    IonSearchbar,
    IonSkeletonText,
    SearchbarLabelDirective,
    SheetShell,
    TranslatePipe,
  ],
  templateUrl: './invite-people-sheet.html',
  styleUrl: './invite-people-sheet.scss',
})
export class InvitePeopleSheet {
  private readonly _clientService = inject(ClientService);
  private readonly _groupService = inject(GroupService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);
  private readonly _destroyRef = inject(DestroyRef);

  readonly open = model(false);
  readonly groupId = input.required<string>();
  readonly groupName = input('');
  /** Whether the invite link row shows: the owner, with the coach role. */
  readonly showLink = input(false);
  /** Whether the group has a live link, for the row's second line. */
  readonly hasLink = input(false);

  readonly invited = output<void>();
  readonly link = output<void>();

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly query = signal('');

  private readonly _clients = signal<InstructorClient[]>([]);
  private readonly _existingIds = signal<ReadonlySet<string>>(new Set());
  private readonly _selected = signal<ReadonlySet<string>>(new Set());
  private _linkAfterClose = false;

  /** Active clients who are not members yet. */
  private readonly _invitable = computed(() => {
    const existing = this._existingIds();
    return this._clients().filter((row) => !!row.client && !existing.has(row.clientId));
  });

  readonly visible = computed(() => {
    const term = this.query().trim().toLowerCase();
    const rows = this._invitable();
    if (!term) {
      return rows;
    }
    return rows.filter((row) => clientDisplayName(row).toLowerCase().includes(term));
  });

  readonly selectedCount = computed(() => this._selected().size);
  readonly allSelected = computed(() => {
    const rows = this.visible();
    return rows.length > 0 && rows.every((row) => this._selected().has(row.clientId));
  });
  readonly canSave = computed(() => this.selectedCount() > 0 && !this.saving());
  readonly saveLabel = computed(() =>
    this._translateService.instant('groups.invitePeople.save', { count: this.selectedCount() }),
  );
  readonly linkLine = computed(() => {
    if (this.hasLink()) {
      return 'groups.detail.inviteLink.active';
    }
    return 'groups.detail.inviteLink.none';
  });

  readonly isEmpty = computed(() => !this.loading() && this._invitable().length === 0);
  readonly isFilteredEmpty = computed(
    () => !this.loading() && this._invitable().length > 0 && this.visible().length === 0,
  );

  show(): void {
    this.query.set('');
    this.open.set(true);
    this._load();
  }

  name(client: InstructorClient): string {
    return clientDisplayName(client);
  }

  tone(client: InstructorClient): string {
    return avatarToneFor(client.clientId);
  }

  isSelected(client: InstructorClient): boolean {
    return this._selected().has(client.clientId);
  }

  toggle(client: InstructorClient): void {
    this._selected.update((set) => {
      const next = new Set(set);
      if (next.has(client.clientId)) {
        next.delete(client.clientId);
      } else {
        next.add(client.clientId);
      }
      return next;
    });
  }

  /** Select all or none of the rows on screen. */
  toggleAll(): void {
    const rows = this.visible();
    if (this.allSelected()) {
      this._selected.update((set) => {
        const next = new Set(set);
        for (const row of rows) {
          next.delete(row.clientId);
        }
        return next;
      });
      return;
    }
    this._selected.update((set) => {
      const next = new Set(set);
      for (const row of rows) {
        next.add(row.clientId);
      }
      return next;
    });
  }

  onQuery(value: string): void {
    this.query.set(value);
  }

  openLink(): void {
    this._linkAfterClose = true;
    this.open.set(false);
  }

  onDismissed(): void {
    if (this._linkAfterClose) {
      this._linkAfterClose = false;
      this.link.emit();
    }
  }

  save(): void {
    if (!this.canSave()) {
      return;
    }
    const userIds = [...this._selected()];
    this.saving.set(true);
    this._groupService
      .inviteClients(this.groupId(), userIds)
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          this.open.set(false);
          this._selected.set(new Set());
          let message = this._translateService.instant('groups.invitePeople.toast.sent', {
            count: result.invited,
          });
          if (result.invited === 0) {
            message = this._translateService.instant('groups.invitePeople.toast.alreadyInvited');
          }
          void this._feedbackService.success(message);
          this.invited.emit();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          void this._feedbackService.error(
            error,
            this._translateService.instant('groups.invitePeople.toast.failed'),
          );
        },
      });
  }

  private _load(): void {
    if (this.loading()) {
      return;
    }
    this.loading.set(true);
    this._selected.set(new Set());
    forkJoin({
      clients: this._clientService.getClients(
        { status: InstructorClientStatuses.Active, limit: 100 },
        { silent: true },
      ),
      members: this._groupService.getMembers(this.groupId(), 1, 100),
    })
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: ({ clients, members }) => {
          this._clients.set(clients.items);
          this._existingIds.set(new Set(members.items.map((member) => member.userId)));
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          void this._feedbackService.error(
            error,
            this._translateService.instant('groups.addMembers.toast.loadFailed'),
          );
          this.open.set(false);
        },
      });
  }
}
