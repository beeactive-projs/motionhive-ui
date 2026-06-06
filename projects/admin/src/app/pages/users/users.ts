import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule, type TableLazyLoadEvent } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageService } from 'primeng/api';
import { AuthStore, showApiError } from 'core';
import { AdminUsersService } from '../../_data/services/admin-users.service';
import { AdminImpersonationService } from '../../_data/services/admin-impersonation.service';
import {
  AdminUserActivity,
  AdminUserDetail,
  AdminUserFilters,
  AdminUserListItem,
} from '../../_data/models/admin.models';
import { resolveWebAppUrl } from '../../_data/web-app-url.util';

const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'INSTRUCTOR', 'WRITER', 'USER'];

@Component({
  selector: 'mh-admin-users',
  imports: [
    DatePipe,
    FormsModule,
    TableModule,
    TagModule,
    ButtonModule,
    DrawerModule,
    InputTextModule,
    SelectModule,
    CheckboxModule,
  ],
  templateUrl: './users.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Users {
  private readonly _users = inject(AdminUsersService);
  private readonly _impersonation = inject(AdminImpersonationService);
  private readonly _authStore = inject(AuthStore);
  private readonly _messages = inject(MessageService);

  readonly isSuperAdmin = this._authStore.isSuperAdmin;
  readonly roleOptions = ALL_ROLES.map((r) => ({ label: r, value: r }));
  readonly assignableRoles = ALL_ROLES;

  readonly rows = 20;
  readonly loading = signal(false);
  readonly items = signal<AdminUserListItem[]>([]);
  readonly total = signal(0);
  private currentPage = 1;

  // Filters (bound via ngModel).
  q = '';
  role: string | null = null;
  isActive: boolean | null = null;
  locked = false;
  includeDeleted = false;

  // Detail drawer.
  readonly drawerOpen = signal(false);
  readonly detailLoading = signal(false);
  readonly detail = signal<AdminUserDetail | null>(null);
  readonly activity = signal<AdminUserActivity | null>(null);
  impersonateReason = '';
  roleToAssign: string | null = null;

  onLazyLoad(event: TableLazyLoadEvent): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.rows;
    this.currentPage = Math.floor(first / rows) + 1;
    this.load();
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    const filters: AdminUserFilters = {
      page: this.currentPage,
      limit: this.rows,
      q: this.q || undefined,
      role: this.role ?? undefined,
      isActive: this.isActive ?? undefined,
      locked: this.locked || undefined,
      includeDeleted: this.includeDeleted || undefined,
    };
    this._users.list(filters).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        showApiError(this._messages, 'Users', 'Failed to load users', err);
      },
    });
  }

  openDetail(id: string): void {
    this.drawerOpen.set(true);
    this.detail.set(null);
    this.activity.set(null);
    this.impersonateReason = '';
    this.roleToAssign = null;
    this.detailLoading.set(true);
    this._users.get(id).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.detailLoading.set(false);
      },
      error: (err) => {
        this.detailLoading.set(false);
        this.drawerOpen.set(false);
        showApiError(this._messages, 'User', 'Failed to load user', err);
      },
    });
    // Activity loads in parallel — counts only (GDPR-safe), best-effort.
    this._users.activity(id).subscribe({
      next: (a) => this.activity.set(a),
      error: () => this.activity.set(null),
    });
  }

  private patchStatus(payload: {
    isActive?: boolean;
    unlock?: boolean;
    forceEmailVerified?: boolean;
  }): void {
    const d = this.detail();
    if (!d) return;
    this._users.updateStatus(d.id, payload).subscribe({
      next: (updated) => {
        this.detail.set(updated);
        this.syncRow(updated);
        this.toast('Updated', `${updated.email} updated.`);
      },
      error: (err) => showApiError(this._messages, 'Update', 'Failed to update user', err),
    });
  }

  toggleActive(): void {
    const d = this.detail();
    if (d) this.patchStatus({ isActive: !d.isActive });
  }
  unlock(): void {
    this.patchStatus({ unlock: true });
  }
  forceVerify(): void {
    this.patchStatus({ forceEmailVerified: true });
  }

  restore(): void {
    const d = this.detail();
    if (!d) return;
    this._users.restore(d.id).subscribe({
      next: (updated) => {
        this.detail.set(updated);
        this.syncRow(updated);
        this.toast('Restored', `${updated.email} restored.`);
      },
      error: (err) => showApiError(this._messages, 'Restore', 'Failed to restore user', err),
    });
  }

  assignRole(): void {
    const d = this.detail();
    if (!d || !this.roleToAssign) return;
    this._users.assignRole(d.id, this.roleToAssign).subscribe({
      next: (res) => {
        this.detail.update((cur) => (cur ? { ...cur, roles: res.roles } : cur));
        this.roleToAssign = null;
        this.toast('Role assigned', 'Roles updated.');
      },
      error: (err) => showApiError(this._messages, 'Roles', 'Failed to assign role', err),
    });
  }

  revokeRole(role: string): void {
    const d = this.detail();
    if (!d) return;
    this._users.revokeRole(d.id, role).subscribe({
      next: (res) => {
        this.detail.update((cur) => (cur ? { ...cur, roles: res.roles } : cur));
        this.toast('Role revoked', 'Roles updated.');
      },
      error: (err) => showApiError(this._messages, 'Roles', 'Failed to revoke role', err),
    });
  }

  impersonate(): void {
    const d = this.detail();
    if (!d) return;
    const reason = this.impersonateReason.trim();
    if (reason.length < 3) {
      this.toast('Reason required', 'Enter a reason (min 3 chars) to impersonate.', 'warn');
      return;
    }
    this._impersonation.impersonate(d.id, reason).subscribe({
      next: (res) => {
        const url = `${resolveWebAppUrl()}/impersonate?token=${encodeURIComponent(res.accessToken)}`;
        window.open(url, '_blank', 'noopener');
        this.toast('Impersonating', `Opened a session as ${res.targetUser.email}.`);
        this.impersonateReason = '';
      },
      error: (err) =>
        showApiError(this._messages, 'Impersonate', 'Failed to impersonate user', err),
    });
  }

  private syncRow(updated: AdminUserDetail): void {
    this.items.update((list) =>
      list.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)),
    );
  }

  private toast(summary: string, detail: string, severity: 'success' | 'warn' = 'success'): void {
    this._messages.add({ severity, summary, detail });
  }
}
