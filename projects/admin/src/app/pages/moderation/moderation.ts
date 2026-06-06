import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AuthStore, showApiError, type PaginatedResponse } from 'core';
import { AdminModerationService } from '../../_data/services/admin-moderation.service';
import { DbRow } from '../../_data/models/admin.models';
import { getPath } from '../../_data/cell.util';

type SectionKey =
  | 'reports'
  | 'velocity'
  | 'posts'
  | 'reviews'
  | 'feedback'
  | 'waitlist';
type Access = 'msg' | 'content' | 'admin';

interface Section {
  key: SectionKey;
  label: string;
  access: Access;
  columns: { path: string; label: string }[];
}

const SECTIONS: Section[] = [
  {
    key: 'reports',
    label: 'Reports',
    access: 'msg',
    columns: [
      { path: 'createdAt', label: 'When' },
      { path: 'category', label: 'Category' },
      { path: 'status', label: 'Status' },
      { path: 'reportedUserId', label: 'Reported' },
      { path: 'notes', label: 'Notes' },
    ],
  },
  {
    key: 'velocity',
    label: 'Velocity alarms',
    access: 'msg',
    columns: [
      { path: 'createdAt', label: 'When' },
      { path: 'userId', label: 'User' },
      { path: 'messageCount', label: 'Msgs' },
      { path: 'threshold', label: 'Threshold' },
      { path: 'reviewedAt', label: 'Reviewed' },
    ],
  },
  {
    key: 'posts',
    label: 'Posts',
    access: 'content',
    columns: [
      { path: 'createdAt', label: 'When' },
      { path: 'author.email', label: 'Author' },
      { path: 'content', label: 'Content' },
      { path: 'approvalState', label: 'State' },
    ],
  },
  {
    key: 'reviews',
    label: 'Reviews',
    access: 'content',
    columns: [
      { path: 'createdAt', label: 'When' },
      { path: 'author.email', label: 'Author' },
      { path: 'rating', label: 'Rating' },
      { path: 'body', label: 'Body' },
    ],
  },
  {
    key: 'feedback',
    label: 'Feedback',
    access: 'admin',
    columns: [
      { path: 'createdAt', label: 'When' },
      { path: 'type', label: 'Type' },
      { path: 'title', label: 'Title' },
      { path: 'email', label: 'Email' },
    ],
  },
  {
    key: 'waitlist',
    label: 'Waitlist',
    access: 'admin',
    columns: [
      { path: 'createdAt', label: 'When' },
      { path: 'email', label: 'Email' },
      { path: 'name', label: 'Name' },
      { path: 'role', label: 'Role' },
      { path: 'source', label: 'Source' },
    ],
  },
];

@Component({
  selector: 'mh-admin-moderation',
  imports: [
    FormsModule,
    TableModule,
    ButtonModule,
    SelectButtonModule,
    ConfirmDialogModule,
  ],
  providers: [ConfirmationService],
  templateUrl: './moderation.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Moderation {
  private readonly _mod = inject(AdminModerationService);
  private readonly _authStore = inject(AuthStore);
  private readonly _messages = inject(MessageService);
  private readonly _confirm = inject(ConfirmationService);

  private readonly isMsgStaff =
    this._authStore.isSuperAdmin() || this._authStore.isSupport();
  private readonly isAdminPlus =
    this._authStore.isAdmin() || this._authStore.isSuperAdmin();

  readonly sectionOptions = computed(() =>
    SECTIONS.filter((s) => {
      if (s.access === 'msg') return this.isMsgStaff;
      if (s.access === 'admin') return this.isAdminPlus;
      return true; // content: any admin-app role
    }).map((s) => ({ label: s.label, value: s.key })),
  );

  section: SectionKey = this.sectionOptions()[0]?.value ?? 'posts';
  readonly items = signal<DbRow[]>([]);
  readonly loading = signal(false);

  constructor() {
    this.load();
  }

  get current(): Section {
    return SECTIONS.find((s) => s.key === this.section) ?? SECTIONS[0];
  }
  cell(row: DbRow, path: string): string {
    return getPath(row, path);
  }
  canDeleteContent(): boolean {
    return this.isAdminPlus;
  }

  onSectionChange(): void {
    this.load();
  }

  private fetch(): Observable<DbRow[]> {
    switch (this.section) {
      case 'reports':
        return this._mod.reports(1, 100).pipe(map((r) => r.items));
      case 'velocity':
        return this._mod.velocityAlarms(1, 100).pipe(map((r) => r.items));
      case 'posts':
        return this._mod.posts(1, 100).pipe(map((r) => r.items));
      case 'reviews':
        return this._mod.reviews(1, 100).pipe(map((r) => r.items));
      case 'feedback':
        return this._mod.feedback();
      case 'waitlist':
        return this._mod.waitlist();
    }
  }

  private load(): void {
    this.loading.set(true);
    this.fetch().subscribe({
      next: (rows) => {
        this.items.set(this.normalize(rows));
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        showApiError(this._messages, 'Moderation', 'Failed to load', err);
      },
    });
  }

  // Some legacy endpoints may return a PaginatedResponse instead of a raw
  // array — normalize both to a row array.
  private normalize(rows: DbRow[] | PaginatedResponse<DbRow>): DbRow[] {
    if (Array.isArray(rows)) return rows;
    return (rows as PaginatedResponse<DbRow>).items ?? [];
  }

  resolveReport(row: DbRow, status: 'RESOLVED' | 'DISMISSED'): void {
    this._mod.resolveReport(String(row['id']), status).subscribe({
      next: () => {
        this._messages.add({ severity: 'success', summary: 'Report', detail: status });
        this.load();
      },
      error: (err) => showApiError(this._messages, 'Report', 'Failed', err),
    });
  }

  reviewAlarm(row: DbRow): void {
    this._mod.reviewAlarm(String(row['id'])).subscribe({
      next: () => {
        this._messages.add({ severity: 'success', summary: 'Alarm', detail: 'Reviewed' });
        this.load();
      },
      error: (err) => showApiError(this._messages, 'Alarm', 'Failed', err),
    });
  }

  deleteContent(row: DbRow): void {
    const isPost = this.section === 'posts';
    this._confirm.confirm({
      header: isPost ? 'Delete post' : 'Delete review',
      message: 'Soft-delete (hide) this content?',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        const id = String(row['id']);
        const op = isPost ? this._mod.deletePost(id) : this._mod.deleteReview(id);
        op.subscribe({
          next: () => {
            this._messages.add({ severity: 'success', summary: 'Deleted', detail: 'Hidden.' });
            this.load();
          },
          error: (err) => showApiError(this._messages, 'Delete', 'Failed', err),
        });
      },
    });
  }
}
