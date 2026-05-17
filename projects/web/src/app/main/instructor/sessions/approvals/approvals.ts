import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import {
  DateWindowsMs,
  PageShell,
  SessionInstance,
  SessionService,
} from 'core';

/**
 * Approvals inbox — lists instances with `pendingApprovalCount > 0`.
 *
 * **V1 limitation**: the BE does NOT yet have a dedicated
 * `GET /sessions/approvals` endpoint. We approximate by pulling the
 * upcoming instances and filtering client-side. Acceptable while
 * approval-required sessions are an exception; revisit if it becomes
 * the default.
 *
 * **Planned BE follow-up** (~80 LOC):
 *   - `GET /sessions/approvals` returns participants grouped by instance
 *   - Eager-load the user + instance + template so the FE can show a
 *     single page of "approve / decline" rows without N+1 calls
 *
 * Once that ships, this page replaces the local filter with a single
 * API call.
 */
@Component({
  selector: 'mh-instructor-approvals',
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonModule, TagModule, PageShell],
  template: `
    <mh-page-shell
      title="Approvals"
      [breadcrumb]="[
        { label: 'Coaching', routerLink: '/coaching/overview' },
        { label: 'Sessions', routerLink: '/coaching/sessions' },
        { label: 'Approvals' }
      ]"
      [showBack]="true"
    >
      <div actions>
        <p-button
          label="Refresh"
          icon="pi pi-refresh"
          severity="secondary"
          [outlined]="true"
          [loading]="loading()"
          (onClick)="load()"
        />
      </div>

      <div class="mh-app__beta">
        <i class="pi pi-info-circle"></i>
        Approvals inbox shows sessions waiting on your decision. Click a row
        to open the session and approve / decline each participant.
      </div>

      @if (loading() && rows().length === 0) {
        <div class="mh-app__loading">Loading…</div>
      } @else if (rows().length === 0) {
        <div class="mh-app__empty">
          <i class="pi pi-inbox"></i>
          <p>You're all caught up — no pending approvals.</p>
        </div>
      } @else {
        <ul class="mh-app__rows">
          @for (i of rows(); track i.id) {
            <li>
              <a class="mh-app__row" [routerLink]="['/coaching/sessions', i.id]">
                <div class="mh-app__row-main">
                  <strong>{{ i.template?.title ?? 'Session' }}</strong>
                  <span class="mh-app__row-time">
                    {{ i.startAt | date: 'EEE d MMM, HH:mm' }}
                  </span>
                </div>
                <p-tag
                  [value]="i.pendingApprovalCount + ' pending'"
                  severity="warn"
                />
                <i class="pi pi-chevron-right"></i>
              </a>
            </li>
          }
        </ul>
      }
    </mh-page-shell>
  `,
  styles: `
    :host { display: block; padding: 24px; }
    .mh-app__beta {
      margin: 16px 0;
      padding: 10px 14px;
      background: var(--p-blue-50);
      color: var(--p-blue-900);
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      i { color: var(--p-blue-600); }
    }
    .mh-app__loading {
      padding: 32px; text-align: center; color: var(--p-text-muted-color); font-size: 14px;
    }
    .mh-app__empty {
      padding: 48px 24px; text-align: center; color: var(--p-text-muted-color);
      i { font-size: 32px; display: block; margin-bottom: 12px; }
      p { margin: 0; font-size: 14px; }
    }
    .mh-app__rows {
      list-style: none; padding: 0; margin: 0;
      display: flex; flex-direction: column; gap: 4px;
    }
    .mh-app__row {
      display: grid;
      grid-template-columns: 1fr auto auto;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      background: var(--p-content-background);
      border: 1px solid var(--p-content-border-color);
      border-radius: 8px;
      text-decoration: none;
      color: inherit;
      transition: all 120ms ease;
      &:hover {
        border-color: var(--p-primary-300);
        background: var(--p-primary-50);
      }
    }
    .mh-app__row-main {
      display: flex; flex-direction: column; gap: 2px;
      strong { font-size: 14px; color: var(--p-text-color); }
    }
    .mh-app__row-time { font-size: 12px; color: var(--p-primary-700); font-weight: 600; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstructorApprovals implements OnInit {
  private readonly _svc = inject(SessionService);

  readonly loading = signal(false);
  readonly all = signal<SessionInstance[]>([]);

  readonly rows = computed(() =>
    this.all()
      .filter((i) => i.pendingApprovalCount > 0)
      .sort(
        (a, b) =>
          new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      ),
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const now = new Date();
    const horizon = new Date(now.getTime() + DateWindowsMs.ApprovalsHorizon);
    this._svc
      .listInstances({
        dateFrom: now.toISOString(),
        dateTo: horizon.toISOString(),
        status: 'SCHEDULED',
        limit: 100,
      })
      .subscribe({
        next: (res) => {
          this.all.set(res.items);
          this.loading.set(false);
        },
        error: () => {
          this.all.set([]);
          this.loading.set(false);
        },
      });
  }
}
