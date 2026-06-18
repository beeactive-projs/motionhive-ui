import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { SessionsDetailStore } from 'core';
import { ParticipantsTable } from '../../../../_shared/components/participants-table/participants-table';
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
    ButtonModule,
    ParticipantsTable,
    FollowUpDialog,
    ToastModule,
  ],
  providers: [SessionsDetailStore, MessageService],
  templateUrl: './attendance.html',
  styleUrl: './attendance.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstructorAttendance implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _location = inject(Location);
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

  protected goBack(): void {
    // Location.back() === history.back(). If we arrived via deep link or a
    // refresh there's no in-app history to pop, so fall back to the session
    // (or the list when the instance hasn't loaded yet).
    if (this._router.lastSuccessfulNavigation()?.previousNavigation) {
      this._location.back();
    } else {
      const inst = this.store.instance();
      void this._router.navigate(
        inst ? ['/coaching/sessions', inst.id] : ['/coaching/sessions'],
      );
    }
  }

  protected onMark(e: { id: string; attended: boolean }): void {
    this.store.setAttendance(e.id, e.attended);
  }
}
