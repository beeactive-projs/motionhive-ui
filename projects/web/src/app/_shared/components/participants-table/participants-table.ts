import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SessionParticipant, SessionParticipantStatus } from 'core';

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
  imports: [CommonModule, TableModule, ButtonModule, TagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './participants-table.html',
  styleUrl: './participants-table.scss',
})
export class ParticipantsTable {
  readonly participants = input.required<SessionParticipant[]>();
  readonly mode = input<'roster' | 'attendance' | 'readonly'>('roster');
  readonly pageSize = input(25);
  /** Set of in-flight participant ids — disables their actions. */
  readonly busyIds = input<Set<string>>(new Set());

  readonly approve = output<string>();
  readonly decline = output<string>();
  readonly markAttended = output<{ id: string; attended: boolean }>();

  protected readonly Status = SessionParticipantStatus;

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
    return this.busyIds().has(id);
  }

  protected statusLabel(s: string): string {
    switch (s) {
      case this.Status.Confirmed: return 'Confirmed';
      case this.Status.PendingApproval: return 'Pending';
      case this.Status.Waitlisted: return 'Waitlisted';
      case this.Status.Cancelled: return 'Cancelled';
      case this.Status.Declined: return 'Declined';
      default: return s;
    }
  }

  protected statusSeverity(
    s: string,
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (s) {
      case this.Status.Confirmed: return 'success';
      case this.Status.PendingApproval: return 'warn';
      case this.Status.Waitlisted: return 'info';
      case this.Status.Cancelled:
      case this.Status.Declined: return 'danger';
      default: return 'secondary';
    }
  }
}
