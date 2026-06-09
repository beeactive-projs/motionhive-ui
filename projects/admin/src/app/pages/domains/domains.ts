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
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { CheckboxModule } from 'primeng/checkbox';
import { TextareaModule } from 'primeng/textarea';
import { DialogModule } from 'primeng/dialog';
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
    SelectModule,
    InputTextModule,
    InputNumberModule,
    CheckboxModule,
    TextareaModule,
    DialogModule,
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
  statusFilter: string | null = null;
  readonly sessionStatuses = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
  readonly exerciseSources = ['SYSTEM', 'INSTRUCTOR', 'ADMIN'];
  readonly items = signal<DbRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  private page = 1;

  // Exercise edit dialog
  readonly editOpen = signal(false);
  readonly saving = signal(false);
  private editId: string | null = null;
  readonly form = signal<Record<string, unknown>>({});
  readonly opt = {
    kind: ['STRENGTH', 'CARDIO', 'DURATION', 'DISTANCE', 'BODYWEIGHT', 'MOBILITY'],
    level: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'],
    mechanic: ['COMPOUND', 'ISOLATION'],
    force: ['PUSH', 'PULL', 'STATIC'],
    movementPattern: [
      'SQUAT', 'HINGE', 'LUNGE', 'PUSH_HORIZONTAL', 'PUSH_VERTICAL',
      'PULL_HORIZONTAL', 'PULL_VERTICAL', 'CARRY', 'ROTATION',
      'ANTI_ROTATION', 'LOCOMOTION', 'ISOLATION',
    ],
    visibility: ['PRIVATE', 'PUBLIC'],
  };

  get columns(): Col[] {
    return COLUMNS[this.resource];
  }
  /** Resources that support a soft-delete moderation action. */
  isDeletable(): boolean {
    return this.resource === 'groups' || this.resource === 'exercises';
  }
  isExercises(): boolean {
    return this.resource === 'exercises';
  }

  openEditExercise(row: DbRow): void {
    this.editId = String(row['id']);
    this.editOpen.set(true);
    this.form.set({});
    this._domain.getExercise(this.editId).subscribe({
      next: (ex) => {
        this.form.set({
          name: ex['name'] ?? '',
          description: ex['description'] ?? '',
          instructions: ex['instructions'] ?? '',
          kind: ex['kind'] ?? null,
          level: ex['level'] ?? null,
          mechanic: ex['mechanic'] ?? null,
          force: ex['force'] ?? null,
          movementPattern: ex['movementPattern'] ?? null,
          visibility: ex['visibility'] ?? null,
          metValue: ex['metValue'] ?? null,
          thumbnailUrl: ex['thumbnailUrl'] ?? '',
          youtubeUrl: ex['youtubeUrl'] ?? '',
          isUnilateral: ex['isUnilateral'] ?? false,
        });
      },
      error: (err) => {
        this.editOpen.set(false);
        showApiError(this._messages, 'Exercise', 'Failed to load exercise', err);
      },
    });
  }

  fval(key: string): unknown {
    return this.form()[key];
  }
  setF(key: string, value: unknown): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  saveExercise(): void {
    if (!this.editId) return;
    this.saving.set(true);
    this._domain.updateExercise(this.editId, this.form()).subscribe({
      next: () => {
        this.saving.set(false);
        this.editOpen.set(false);
        this._messages.add({ severity: 'success', summary: 'Saved', detail: 'Exercise updated.' });
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        showApiError(this._messages, 'Save', 'Failed to update exercise', err);
      },
    });
  }

  onResourceChange(): void {
    this.q = '';
    this.statusFilter = null;
    this.page = 1;
    this.load();
  }
  applySearch(): void {
    this.page = 1;
    this.load();
  }
  /** Sessions filter by status; exercises filter by source (both map to
   *  the backend `status` param). Other resources have no status filter. */
  filterOptions(): string[] {
    if (this.resource === 'sessions') return this.sessionStatuses;
    if (this.resource === 'exercises') return this.exerciseSources;
    return [];
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

  confirmDelete(row: DbRow): void {
    const id = String(row['id']);
    const isGroup = this.resource === 'groups';
    this._confirm.confirm({
      header: isGroup ? 'Delete group' : 'Delete exercise',
      message: isGroup
        ? `Soft-delete "${this.cell(row, 'name')}"? Members keep history; the group is hidden.`
        : `Soft-delete exercise "${this.cell(row, 'name')}"? It's hidden from the catalog; existing references keep their snapshot.`,
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        const op = isGroup
          ? this._domain.deleteGroup(id)
          : this._domain.deleteExercise(id);
        op.subscribe({
          next: () => {
            this._messages.add({ severity: 'success', summary: 'Deleted', detail: 'Hidden.' });
            this.load();
          },
          error: (err) => showApiError(this._messages, 'Delete', 'Failed to delete', err),
        });
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this._domain
      .list(this.resource, this.page, this.rows, this.q || undefined, this.statusFilter ?? undefined)
      .subscribe({
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
