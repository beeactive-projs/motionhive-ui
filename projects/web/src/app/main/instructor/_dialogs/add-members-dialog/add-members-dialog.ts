import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  ClientService,
  GroupService,
  InstructorClient,
  InstructorClientStatuses,
  showApiError,
} from 'core';
import { MessageService } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { ProgressSpinner } from 'primeng/progressspinner';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';

@Component({
  selector: 'mh-add-members-dialog',
  imports: [
    FormsModule,
    Button,
    Dialog,
    InputText,
    AvatarModule,
    ProgressSpinner,
    SkeletonModule,
    TableModule,
  ],
  templateUrl: './add-members-dialog.html',
  styleUrl: './add-members-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddMembersDialog {
  private readonly _clientService = inject(ClientService);
  private readonly _groupService = inject(GroupService);
  private readonly _messageService = inject(MessageService);

  readonly visible = model(false);
  readonly groupId = input.required<string>();
  readonly saved = output<void>();

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly clients = signal<InstructorClient[]>([]);
  readonly existingMemberIds = signal<Set<string>>(new Set());
  readonly selectedClients = signal<InstructorClient[]>([]);

  readonly availableClients = computed(() => {
    const existingIds = this.existingMemberIds();
    return this.clients().filter((c) => c.client && !existingIds.has(c.clientId));
  });

  readonly selectedCount = computed(() => this.selectedClients().length);

  private readonly _loadOnOpen = effect(() => {
    if (this.visible()) {
      this._loadData();
    } else {
      this.selectedClients.set([]);
    }
  });

  private _loadData(): void {
    this.loading.set(true);
    forkJoin({
      clients: this._clientService.getClients({
        status: InstructorClientStatuses.Active,
        limit: 100,
      }),
      members: this._groupService.getMembers(this.groupId(), 1, 100),
    }).subscribe({
      next: ({ clients, members }) => {
        this.clients.set(clients.items);
        this.existingMemberIds.set(new Set(members.items.map((m) => m.userId)));
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        showApiError(this._messageService, 'Error', 'Failed to load clients', err);
        this.visible.set(false);
      },
    });
  }

  clientInitials(client: InstructorClient): string {
    if (!client.client) return '??';
    return client.client.firstName.charAt(0) + client.client.lastName.charAt(0);
  }

  clientName(client: InstructorClient): string {
    if (!client.client) return '—';
    return `${client.client.firstName} ${client.client.lastName}`;
  }

  saveMembers(): void {
    const selected = this.selectedClients();
    if (!selected.length) return;

    this.saving.set(true);
    const groupId = this.groupId();

    forkJoin(selected.map((c) => this._groupService.addMember(groupId, c.clientId))).subscribe({
      next: () => {
        this.saving.set(false);
        this.visible.set(false);
        this._messageService.add({
          severity: 'success',
          summary: 'Members added',
          detail: `${selected.length} ${selected.length === 1 ? 'member' : 'members'} added to the group`,
        });
        this.saved.emit();
      },
      error: (err) => {
        this.saving.set(false);
        showApiError(this._messageService, 'Error', 'Failed to add members', err);
      },
    });
  }
}
