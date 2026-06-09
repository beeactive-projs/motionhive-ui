import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
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
  searchable: boolean;
  columns: { path: string; label: string }[];
}

const SECTIONS: Section[] = [
  {
    key: 'reports', label: 'Reports', access: 'msg', searchable: false,
    columns: [
      { path: 'createdAt', label: 'When' },
      { path: 'category', label: 'Category' },
      { path: 'status', label: 'Status' },
      { path: 'reportedUserId', label: 'Reported' },
      { path: 'notes', label: 'Notes' },
    ],
  },
  {
    key: 'velocity', label: 'Velocity alarms', access: 'msg', searchable: false,
    columns: [
      { path: 'createdAt', label: 'When' },
      { path: 'userId', label: 'User' },
      { path: 'messageCount', label: 'Msgs' },
      { path: 'threshold', label: 'Threshold' },
      { path: 'reviewedAt', label: 'Reviewed' },
    ],
  },
  {
    key: 'posts', label: 'Posts', access: 'content', searchable: true,
    columns: [
      { path: 'createdAt', label: 'When' },
      { path: 'author.email', label: 'Author' },
      { path: 'content', label: 'Content' },
      { path: 'approvalState', label: 'State' },
    ],
  },
  {
    key: 'reviews', label: 'Reviews', access: 'content', searchable: true,
    columns: [
      { path: 'createdAt', label: 'When' },
      { path: 'author.email', label: 'Author' },
      { path: 'rating', label: 'Rating' },
      { path: 'body', label: 'Body' },
    ],
  },
  {
    key: 'feedback', label: 'Feedback', access: 'admin', searchable: true,
    columns: [
      { path: 'createdAt', label: 'When' },
      { path: 'type', label: 'Type' },
      { path: 'title', label: 'Title' },
      { path: 'email', label: 'Email' },
    ],
  },
  {
    key: 'waitlist', label: 'Waitlist', access: 'admin', searchable: true,
    columns: [
      { path: 'createdAt', label: 'When' },
      { path: 'email', label: 'Email' },
      { path: 'name', label: 'Name' },
      { path: 'role', label: 'Role' },
      { path: 'source', label: 'Source' },
    ],
  },
];

const REPORT_STATUSES = ['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED'];
const REPORT_CATEGORIES = ['SPAM', 'SCAM', 'HARASSMENT', 'IMPERSONATION', 'SEXUAL', 'OTHER'];

@Component({
  selector: 'mh-admin-moderation',
  imports: [
    FormsModule,
    TableModule,
    ButtonModule,
    SelectButtonModule,
    SelectModule,
    InputTextModule,
    CheckboxModule,
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

  readonly reportStatuses = REPORT_STATUSES;
  readonly reportCategories = REPORT_CATEGORIES;

  readonly sectionOptions = computed(() =>
    SECTIONS.filter((s) => {
      if (s.access === 'msg') return this.isMsgStaff;
      if (s.access === 'admin') return this.isAdminPlus;
      return true;
    }).map((s) => ({ label: s.label, value: s.key })),
  );

  section: SectionKey = this.sectionOptions()[0]?.value ?? 'posts';
  readonly rows = 20;
  readonly items = signal<DbRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  private page = 1;

  // filters
  q = '';
  reportStatus: string | null = null;
  reportCategory: string | null = null;
  velocityIncludeReviewed = false;

  constructor() {
    this.reload();
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
    this.q = '';
    this.reportStatus = null;
    this.reportCategory = null;
    this.reload();
  }

  reload(): void {
    this.page = 1;
    this.load();
  }

  onLazyLoad(e: TableLazyLoadEvent): void {
    const first = e.first ?? 0;
    const rows = e.rows ?? this.rows;
    this.page = Math.floor(first / rows) + 1;
    this.load();
  }

  private fetch(): Observable<PaginatedResponse<DbRow>> {
    const p = this.page;
    const l = this.rows;
    const q = this.q || undefined;
    switch (this.section) {
      case 'reports':
        return this._mod.reports(p, l, this.reportStatus ?? undefined, this.reportCategory ?? undefined);
      case 'velocity':
        return this._mod.velocityAlarms(p, l, this.velocityIncludeReviewed);
      case 'posts':
        return this._mod.posts(p, l, q);
      case 'reviews':
        return this._mod.reviews(p, l, q);
      case 'feedback':
        return this._mod.feedback(p, l, q);
      case 'waitlist':
        return this._mod.waitlist(p, l, q);
    }
  }

  private load(): void {
    this.loading.set(true);
    this.fetch().subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        showApiError(this._messages, 'Moderation', 'Failed to load', err);
      },
    });
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
