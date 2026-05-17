import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  PageShell,
  ParticipantsTable,
  SessionsDetailStore,
} from 'core';
import { FollowUpDialog } from '../_dialogs/follow-up-dialog/follow-up-dialog';

/**
 * Day-of attendance check-in page (instructor side).
 *
 * `mh-participants-table` runs in `attendance` mode: each confirmed
 * participant has a yes/no toggle wired straight to
 * `SessionsDetailStore.setAttendance`. A "Send follow-up" button opens
 * the `mh-follow-up-dialog` so the instructor can message everyone with
 * a single click after the session ends.
 *
 * Route: `/coaching/sessions/:id/attendance`.
 */
@Component({
  selector: 'mh-instructor-attendance',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ButtonModule,
    PageShell,
    ParticipantsTable,
    FollowUpDialog,
    ToastModule,
  ],
  providers: [SessionsDetailStore, MessageService],
  template: `
    @let inst = store.instance();
    @let tpl = store.template();

    <mh-page-shell
      [title]="tpl?.title ? 'Attendance · ' + tpl?.title : 'Attendance'"
      [breadcrumb]="[
        { label: 'Coaching', routerLink: '/coaching/overview' },
        { label: 'Sessions', routerLink: '/coaching/sessions' },
        { label: tpl?.title ?? 'Session', routerLink: inst ? '/coaching/sessions/' + inst.id : '/coaching/sessions' },
        { label: 'Attendance' }
      ]"
      [showBack]="true"
    >
      <div actions class="mh-att__actions">
        @if (inst) {
          <p-button
            label="Back to session"
            icon="pi pi-arrow-left"
            severity="secondary"
            [outlined]="true"
            [routerLink]="['/coaching/sessions', inst.id]"
          />
          <p-button
            label="Send follow-up"
            icon="pi pi-send"
            (onClick)="followUpOpen.set(true)"
          />
        }
      </div>

      @if (store.loading() && !inst) {
        <div class="mh-att__loading">Loading…</div>
      } @else if (store.error()) {
        <div class="mh-att__error">
          <i class="pi pi-exclamation-circle"></i>
          {{ store.error() }}
        </div>
      } @else if (inst && tpl) {
        <div class="mh-att">
          <header class="mh-att__head">
            <div class="mh-att__time">
              <i class="pi pi-calendar"></i>
              {{ inst.startAt | date: 'EEE d MMM, HH:mm' }}
            </div>
            <div class="mh-att__counters">
              <span class="mh-att__counter mh-att__counter--ok">
                <i class="pi pi-check-circle"></i>
                <strong>{{ store.counts().attended }}</strong> attended
              </span>
              <span class="mh-att__counter mh-att__counter--no">
                <i class="pi pi-times-circle"></i>
                <strong>{{ store.counts().noShow }}</strong> no-show
              </span>
              <span class="mh-att__counter">
                <strong>{{ pendingMark() }}</strong> not marked
              </span>
            </div>
          </header>

          <mh-participants-table
            [participants]="confirmedOnly()"
            mode="attendance"
            [busyIds]="store.busyParticipantIds()"
            (markAttended)="onMark($event)"
          />
        </div>

        <mh-follow-up-dialog
          [visible]="followUpOpen()"
          (visibleChange)="followUpOpen.set($event)"
          [instanceId]="inst.id"
        />
      }
    </mh-page-shell>
    <p-toast position="top-right" />
  `,
  styles: `
    :host { display: block; padding: 24px; }
    .mh-att__actions { display: flex; gap: 8px; }
    .mh-att__loading, .mh-att__error {
      margin-top: 16px; padding: 32px; text-align: center;
      background: color-mix(in srgb, var(--p-text-color) 4%, transparent); border-radius: 12px;
      color: var(--p-text-muted-color); font-size: 14px;
    }
    .mh-att__error { color: var(--p-red-700); i { margin-right: 8px; } }
    .mh-att { margin-top: 16px; display: flex; flex-direction: column; gap: 16px; }
    .mh-att__head {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 14px 16px; background: var(--p-content-background);
      border: 1px solid var(--p-content-border-color); border-radius: 12px;
    }
    .mh-att__time {
      font-size: 14px; font-weight: 600; color: var(--p-primary-700);
      display: flex; align-items: center; gap: 8px;
      i { color: var(--p-primary-500); }
    }
    .mh-att__counters { display: flex; gap: 14px; flex-wrap: wrap; }
    .mh-att__counter {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 13px; color: var(--p-text-muted-color);
      strong { font-size: 15px; color: var(--p-text-color); font-weight: 700; }
      &--ok { color: var(--p-green-700); strong { color: var(--p-green-700); } }
      &--no { color: var(--p-red-700); strong { color: var(--p-red-700); } }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstructorAttendance implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  protected readonly store = inject(SessionsDetailStore);

  readonly followUpOpen = signal(false);

  protected readonly confirmedOnly = computed(() =>
    this.store.participants().filter((p) => p.status === 'CONFIRMED'),
  );

  protected readonly pendingMark = computed(() =>
    this.confirmedOnly().filter((p) => p.attended === null).length,
  );

  ngOnInit(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (id) this.store.load(id);
  }

  protected onMark(e: { id: string; attended: boolean }): void {
    this.store.setAttendance(e.id, e.attended);
  }
}
