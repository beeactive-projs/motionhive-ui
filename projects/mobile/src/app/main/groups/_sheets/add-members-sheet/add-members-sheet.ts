import { Component, DestroyRef, computed, inject, input, model, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  IonCheckbox,
  IonItem,
  IonLabel,
  IonList,
  IonSearchbar,
  IonSkeletonText,
} from '@ionic/angular/standalone';
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
import { FeedbackService } from '../../../../_shared/services/feedback.service';

/**
 * Adding your own clients to a group.
 *
 * Only clients, not any user: the API's bulk endpoint is for people you
 * already coach, and a general people-search would offer names it will
 * reject. Anyone already in the group is filtered out rather than shown
 * greyed — a row you cannot act on is a row worth removing.
 */
@Component({
  selector: 'mh-add-members-sheet',
  imports: [
    EmptyState,
    HexAvatar,
    IonCheckbox,
    IonItem,
    IonLabel,
    IonList,
    IonSearchbar,
    IonSkeletonText,
    SheetShell,
  ],
  templateUrl: './add-members-sheet.html',
  styleUrl: './add-members-sheet.scss',
})
export class AddMembersSheet {
  private readonly _clientService = inject(ClientService);
  private readonly _groupService = inject(GroupService);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _destroyRef = inject(DestroyRef);

  readonly open = model(false);
  readonly groupId = input.required<string>();

  /** Fired once people are in, so the group reloads its member list. */
  readonly added = output<void>();

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly query = signal('');

  private readonly _clients = signal<InstructorClient[]>([]);
  private readonly _existingIds = signal<ReadonlySet<string>>(new Set());
  private readonly _selected = signal<ReadonlySet<string>>(new Set());

  /** Your clients, minus anyone already in the group. */
  private readonly _addable = computed(() => {
    const existing = this._existingIds();
    return this._clients().filter((c) => !!c.client && !existing.has(c.clientId));
  });

  readonly visible = computed(() => {
    const term = this.query().trim().toLowerCase();
    const rows = this._addable();
    if (!term) return rows;
    return rows.filter((c) => clientDisplayName(c).toLowerCase().includes(term));
  });

  readonly selectedCount = computed(() => this._selected().size);
  readonly canSave = computed(() => this.selectedCount() > 0 && !this.saving());

  readonly saveLabel = computed(() => {
    const count = this.selectedCount();
    return count > 0 ? `Add ${count}` : 'Add';
  });

  readonly isEmpty = computed(() => !this.loading() && this._addable().length === 0);

  readonly isFilteredEmpty = computed(
    () => !this.loading() && this._addable().length > 0 && this.visible().length === 0,
  );

  /**
   * Opened by the page, which also triggers the load.
   *
   * Not an `effect` on `open`: the error path closes the sheet, so an effect
   * that reads `open` and writes it back is an effect feeding itself. The
   * page asks for both explicitly instead.
   */
  show(): void {
    this.open.set(true);
    this._load();
  }

  name(client: InstructorClient): string {
    return clientDisplayName(client);
  }

  isSelected(client: InstructorClient): boolean {
    return this._selected().has(client.clientId);
  }

  toggle(client: InstructorClient): void {
    this._selected.update((set) => {
      const next = new Set(set);
      if (next.has(client.clientId)) next.delete(client.clientId);
      else next.add(client.clientId);
      return next;
    });
  }

  onQuery(value: string): void {
    this.query.set(value);
  }

  save(): void {
    if (!this.canSave()) return;
    const userIds = [...this._selected()];
    this.saving.set(true);

    this._groupService
      .addMembersBulk(this.groupId(), userIds)
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (members) => {
          this.saving.set(false);
          this.open.set(false);
          this._selected.set(new Set());
          // The server decides who actually went in — someone may have
          // joined from a link between the list loading and this call.
          const count = members.length;
          void this._feedbackService.success(
            count === 1 ? '1 member added' : `${count} members added`,
          );
          this.added.emit();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          void this._feedbackService.error(error, 'Could not add those members.');
        },
      });
  }

  private _load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this._selected.set(new Set());

    // Both together: the roster is only useful once we know who to drop
    // from it, and two spinners for one list is one too many.
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
          this._existingIds.set(new Set(members.items.map((m) => m.userId)));
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          void this._feedbackService.error(error, 'Could not load your clients.');
          this.open.set(false);
        },
      });
  }
}
