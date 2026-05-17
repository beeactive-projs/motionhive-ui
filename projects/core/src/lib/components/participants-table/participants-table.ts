import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import type { SessionParticipant } from '../../models/session/session.model';

/**
 * `mh-participants-table` — table primitive for a session's roster.
 *
 * Domain-agnostic over a participant array; the consumer wires the
 * action callbacks (`approve` / `decline` / `markAttended`). The
 * component only emits intent — it never calls the API itself.
 *
 * Three column profiles via `mode`:
 *   - `roster`     — pre-session roster (status + approve/decline)
 *   - `attendance` — at-session check-in (attended yes/no/no-record)
 *   - `readonly`   — historical view, no actions
 */
@Component({
  selector: 'mh-participants-table',
  standalone: true,
  imports: [CommonModule, TableModule, ButtonModule, TagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-table
      [value]="participants"
      [paginator]="participants.length > pageSize"
      [rows]="pageSize"
      [rowsPerPageOptions]="[10, 25, 50]"
      styleClass="mh-pt"
      [scrollable]="true"
      scrollHeight="flex"
    >
      <ng-template pTemplate="header">
        <tr>
          <th>Name</th>
          <th>Booked</th>
          <th>Status</th>
          @if (mode !== 'readonly') {
            <th class="mh-pt__th-right">Actions</th>
          }
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-p>
        <tr>
          <td>
            <div class="mh-pt__name">
              @if (p.user?.avatarUrl) {
                <img [src]="p.user.avatarUrl" alt="" class="mh-pt__avatar" />
              } @else {
                <span class="mh-pt__avatar mh-pt__avatar--ph">
                  {{ initials(p) }}
                </span>
              }
              <div class="mh-pt__nameLines">
                <strong>{{ fullName(p) }}</strong>
                @if (p.bookingNote) {
                  <small>“{{ p.bookingNote }}”</small>
                }
              </div>
            </div>
          </td>
          <td>{{ p.bookedAt | date: 'd MMM, HH:mm' }}</td>
          <td>
            <p-tag
              [value]="statusLabel(p.status)"
              [severity]="statusSeverity(p.status)"
            />
          </td>
          @if (mode === 'roster') {
            <td class="mh-pt__td-right">
              @if (p.status === 'PENDING_APPROVAL') {
                <p-button
                  icon="pi pi-check"
                  severity="success"
                  [outlined]="true"
                  size="small"
                  [loading]="isBusy(p.id)"
                  (onClick)="approve.emit(p.id)"
                  ariaLabel="Approve"
                />
                <p-button
                  icon="pi pi-times"
                  severity="danger"
                  [text]="true"
                  size="small"
                  [loading]="isBusy(p.id)"
                  (onClick)="decline.emit(p.id)"
                  ariaLabel="Decline"
                />
              }
            </td>
          } @else if (mode === 'attendance') {
            <td class="mh-pt__td-right">
              <p-button
                icon="pi pi-check"
                severity="success"
                [outlined]="p.attended !== true"
                size="small"
                [loading]="isBusy(p.id)"
                (onClick)="markAttended.emit({ id: p.id, attended: true })"
                ariaLabel="Mark attended"
              />
              <p-button
                icon="pi pi-times"
                severity="danger"
                [outlined]="p.attended !== false"
                [text]="p.attended !== false"
                size="small"
                [loading]="isBusy(p.id)"
                (onClick)="markAttended.emit({ id: p.id, attended: false })"
                ariaLabel="Mark no-show"
              />
            </td>
          }
        </tr>
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr>
          <td [attr.colspan]="mode === 'readonly' ? 3 : 4" class="mh-pt__empty">
            No participants yet.
          </td>
        </tr>
      </ng-template>
    </p-table>
  `,
  styles: `
    :host { display: block; }
    .mh-pt__name { display: flex; align-items: center; gap: 10px; }
    .mh-pt__avatar {
      width: 32px; height: 32px; border-radius: 50%;
      object-fit: cover;
      background: var(--p-surface-200);
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; color: var(--p-text-muted-color);
    }
    .mh-pt__avatar--ph { background: var(--p-primary-100); color: var(--p-primary-700); }
    .mh-pt__nameLines {
      display: flex; flex-direction: column;
      strong { font-size: 13px; color: var(--p-text-color); }
      small { font-size: 11px; color: var(--p-text-muted-color); font-style: italic; }
    }
    .mh-pt__th-right, .mh-pt__td-right { text-align: right; }
    .mh-pt__td-right p-button + p-button { margin-left: 4px; }
    .mh-pt__empty { text-align: center; padding: 24px; color: var(--p-text-muted-color); }
  `,
})
export class ParticipantsTable {
  @Input({ required: true }) participants: SessionParticipant[] = [];
  @Input() mode: 'roster' | 'attendance' | 'readonly' = 'roster';
  @Input() pageSize = 25;
  /** Set of in-flight participant ids — disables their actions. */
  @Input() busyIds: Set<string> = new Set();

  @Output() approve = new EventEmitter<string>();
  @Output() decline = new EventEmitter<string>();
  @Output() markAttended = new EventEmitter<{ id: string; attended: boolean }>();

  protected fullName(p: SessionParticipant): string {
    if (p.user) return `${p.user.firstName} ${p.user.lastName}`;
    return 'Member';
  }

  protected initials(p: SessionParticipant): string {
    if (!p.user) return '?';
    const f = p.user.firstName?.[0] ?? '';
    const l = p.user.lastName?.[0] ?? '';
    return (f + l).toUpperCase() || '?';
  }

  protected isBusy(id: string): boolean {
    return this.busyIds.has(id);
  }

  protected statusLabel(s: string): string {
    switch (s) {
      case 'CONFIRMED': return 'Confirmed';
      case 'PENDING_APPROVAL': return 'Pending';
      case 'WAITLISTED': return 'Waitlisted';
      case 'CANCELLED': return 'Cancelled';
      case 'DECLINED': return 'Declined';
      default: return s;
    }
  }

  protected statusSeverity(
    s: string,
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (s) {
      case 'CONFIRMED': return 'success';
      case 'PENDING_APPROVAL': return 'warn';
      case 'WAITLISTED': return 'info';
      case 'CANCELLED':
      case 'DECLINED': return 'danger';
      default: return 'secondary';
    }
  }
}
