import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AuthStore, showApiError } from 'core';
import {
  AdminDomainService,
  DomainResource,
} from '../../_data/services/admin-domain.service';
import { DbRow } from '../../_data/models/admin.models';
import { getPath } from '../../_data/cell.util';

interface Col {
  path: string;
  label: string;
}

const COLUMNS: Record<DomainResource, Col[]> = {
  groups: [
    { path: 'name', label: 'Name' },
    { path: 'instructor.email', label: 'Owner' },
    { path: 'isPublic', label: 'Public' },
    { path: 'isActive', label: 'Active' },
    { path: 'memberCount', label: 'Members' },
    { path: 'joinPolicy', label: 'Join' },
    { path: 'createdAt', label: 'Created' },
  ],
  sessions: [
    { path: 'template.title', label: 'Template' },
    { path: 'instructor.email', label: 'Instructor' },
    { path: 'status', label: 'Status' },
    { path: 'startAt', label: 'Start' },
    { path: 'confirmedCount', label: 'Confirmed' },
  ],
  venues: [
    { path: 'name', label: 'Name' },
    { path: 'kind', label: 'Kind' },
    { path: 'city', label: 'City' },
    { path: 'isActive', label: 'Active' },
    { path: 'createdAt', label: 'Created' },
  ],
  exercises: [
    { path: 'name', label: 'Name' },
    { path: 'source', label: 'Source' },
    { path: 'visibility', label: 'Visibility' },
    { path: 'owner.email', label: 'Owner' },
    { path: 'forkCount', label: 'Forks' },
  ],
};

@Component({
  selector: 'mh-admin-domains',
  imports: [
    FormsModule,
    TableModule,
    ButtonModule,
    SelectButtonModule,
    InputTextModule,
    ConfirmDialogModule,
  ],
  providers: [ConfirmationService],
  templateUrl: './domains.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Domains {
  private readonly _domain = inject(AdminDomainService);
  private readonly _authStore = inject(AuthStore);
  private readonly _messages = inject(MessageService);
  private readonly _confirm = inject(ConfirmationService);

  readonly canMutate = signal(
    this._authStore.isAdmin() || this._authStore.isSuperAdmin(),
  );
  readonly rows = 20;
  readonly resourceOptions: { label: string; value: DomainResource }[] = [
    { label: 'Groups', value: 'groups' },
    { label: 'Sessions', value: 'sessions' },
    { label: 'Venues', value: 'venues' },
    { label: 'Exercises', value: 'exercises' },
  ];

  resource: DomainResource = 'groups';
  q = '';
  readonly items = signal<DbRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  private page = 1;

  get columns(): Col[] {
    return COLUMNS[this.resource];
  }
  isGroups(): boolean {
    return this.resource === 'groups';
  }

  onResourceChange(): void {
    this.q = '';
    this.page = 1;
    this.load();
  }
  applySearch(): void {
    this.page = 1;
    this.load();
  }
  onLazyLoad(e: TableLazyLoadEvent): void {
    const first = e.first ?? 0;
    const rows = e.rows ?? this.rows;
    this.page = Math.floor(first / rows) + 1;
    this.load();
  }

  cell(row: DbRow, path: string): string {
    return getPath(row, path);
  }

  confirmDeleteGroup(row: DbRow): void {
    const id = String(row['id']);
    this._confirm.confirm({
      header: 'Delete group',
      message: `Soft-delete "${this.cell(row, 'name')}"? Members keep history; the group is hidden.`,
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this._domain.deleteGroup(id).subscribe({
          next: () => {
            this._messages.add({ severity: 'success', summary: 'Deleted', detail: 'Group hidden.' });
            this.load();
          },
          error: (err) => showApiError(this._messages, 'Delete', 'Failed to delete group', err),
        });
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this._domain.list(this.resource, this.page, this.rows, this.q || undefined).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        showApiError(this._messages, 'Domains', 'Failed to load', err);
      },
    });
  }
}
