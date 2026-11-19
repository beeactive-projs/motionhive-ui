import { Component, DestroyRef, computed, inject, model, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  IonAccordion,
  IonAccordionGroup,
  IonButton,
  IonCheckbox,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonRadio,
  IonRadioGroup,
  IonSkeletonText,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { of, switchMap, take } from 'rxjs';

import {
  AuthStore,
  ClientService,
  GroupMemberPostPolicies,
  GroupMemberPostPolicy,
  GroupService,
  InstructorClient,
  InstructorClientStatuses,
  JoinPolicies,
  JoinPolicy,
  clientDisplayName,
} from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { SheetShell } from '../../../../_shared/components/sheet-shell/sheet-shell';
import { FeedbackService } from '../../../../_shared/services/feedback.service';
import { avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';
import {
  GROUP_NAME_MAX_LENGTH,
  JOIN_POLICY_OPTIONS,
  POST_POLICY_OPTIONS,
} from '../../groups.config';

/**
 * A coach's first group in one step, from the Home card (design 2026-11-14):
 * a name already filled in, invite only, anyone may post, and every active
 * client ticked. "Create and invite" makes the group, then invites the
 * ticked clients; each joins only if they accept. Everything can change
 * later on the group itself.
 *
 * `created` carries the new group's id once both calls are done.
 */
@Component({
  selector: 'mh-client-group-sheet',
  imports: [
    HexAvatar,
    IonAccordion,
    IonAccordionGroup,
    IonButton,
    IonCheckbox,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonRadio,
    IonRadioGroup,
    IonSkeletonText,
    SheetShell,
    TranslatePipe,
  ],
  templateUrl: './client-group-sheet.html',
  styleUrl: './client-group-sheet.scss',
})
export class ClientGroupSheet {
  private readonly _authStore = inject(AuthStore);
  private readonly _clientService = inject(ClientService);
  private readonly _groupService = inject(GroupService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);
  private readonly _destroyRef = inject(DestroyRef);

  readonly open = model(false);
  readonly created = output<string>();

  readonly nameMaxLength = GROUP_NAME_MAX_LENGTH;
  readonly joinPolicyOptions = JOIN_POLICY_OPTIONS;
  readonly postPolicyOptions = POST_POLICY_OPTIONS;

  readonly name = signal('');
  readonly joinPolicy = signal<JoinPolicy>(JoinPolicies.InviteOnly);
  readonly postPolicy = signal<GroupMemberPostPolicy>(GroupMemberPostPolicies.Open);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly clients = signal<InstructorClient[]>([]);
  private readonly _selected = signal<ReadonlySet<string>>(new Set());

  readonly selectedCount = computed(() => this._selected().size);

  readonly allSelected = computed(() => {
    const rows = this.clients();
    return rows.length > 0 && rows.every((row) => this._selected().has(row.clientId));
  });

  readonly canSave = computed(() => this.name().trim().length > 0 && !this.saving());

  readonly saveLabel = computed(() =>
    this._translateService.instant('groups.setup.save', { count: this.selectedCount() }),
  );

  readonly joinPolicyLabel = computed(() => {
    const option = JOIN_POLICY_OPTIONS.find((row) => row.value === this.joinPolicy());
    if (!option) {
      return '';
    }
    return option.label;
  });

  readonly postPolicyLabel = computed(() => {
    const option = POST_POLICY_OPTIONS.find((row) => row.value === this.postPolicy());
    if (!option) {
      return '';
    }
    return option.label;
  });

  /** Opens with the defaults and every active client ticked. */
  show(): void {
    const user = this._authStore.user();
    let firstName = '';
    if (user) {
      firstName = user.firstName ?? '';
    }
    this.name.set(this._translateService.instant('groups.setup.defaultName', { name: firstName }));
    this.joinPolicy.set(JoinPolicies.InviteOnly);
    this.postPolicy.set(GroupMemberPostPolicies.Open);
    this.open.set(true);
    this._load();
  }

  setJoinPolicy(value: JoinPolicy): void {
    this.joinPolicy.set(value);
  }

  setPostPolicy(value: GroupMemberPostPolicy): void {
    this.postPolicy.set(value);
  }

  clientName(client: InstructorClient): string {
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

  toggleAll(): void {
    if (this.allSelected()) {
      this._selected.set(new Set());
      return;
    }
    this._selected.set(new Set(this.clients().map((row) => row.clientId)));
  }

  /** The group first, then the invites: there is nothing to invite to before it exists. */
  create(): void {
    if (!this.canSave()) {
      return;
    }
    this.saving.set(true);
    const userIds = [...this._selected()];
    let groupId = '';
    this._groupService
      .create({
        name: this.name().trim(),
        isPublic: false,
        joinPolicy: this.joinPolicy(),
        memberPostPolicy: this.postPolicy(),
      })
      .pipe(
        switchMap((group) => {
          groupId = group.id;
          if (userIds.length === 0) {
            return of({ invited: 0, skipped: 0 });
          }
          return this._groupService.inviteClients(group.id, userIds);
        }),
        take(1),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          this.open.set(false);
          void this._feedbackService.success(
            this._translateService.instant('groups.setup.toast.created', { count: result.invited }),
          );
          this.created.emit(groupId);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          // The group may exist already with the invites missing: say which.
          let message = this._translateService.instant('groups.edit.toast.createFailed');
          if (groupId) {
            message = this._translateService.instant('groups.setup.toast.invitesFailed');
            this.open.set(false);
            this.created.emit(groupId);
          }
          void this._feedbackService.error(error, message);
        },
      });
  }

  private _load(): void {
    if (this.loading()) {
      return;
    }
    this.loading.set(true);
    this._clientService
      .getClients({ status: InstructorClientStatuses.Active, limit: 100 }, { silent: true })
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (page) => {
          const rows = page.items.filter((row) => !!row.client);
          this.clients.set(rows);
          this._selected.set(new Set(rows.map((row) => row.clientId)));
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.clients.set([]);
        },
      });
  }
}
