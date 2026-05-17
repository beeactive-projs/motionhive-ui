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
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  AccessChip,
  CapacityBar,
  PageShell,
  ParticipantsTable,
  ProviderChip,
  SessionInstance,
  SessionTemplate,
  SessionsDetailStore,
  SessionsInstructorStore,
  TypeChip,
} from 'core';
import { SessionFormDialog } from '../_dialogs/session-form-dialog/session-form-dialog';
import { CancelSessionDialog } from '../_dialogs/cancel-session-dialog/cancel-session-dialog';
import { FollowUpDialog } from '../_dialogs/follow-up-dialog/follow-up-dialog';

/** Instructor-facing detail page for a single `SessionInstance`. */
@Component({
  selector: 'mh-instructor-session-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ButtonModule,
    PageShell,
    AccessChip,
    TypeChip,
    ProviderChip,
    CapacityBar,
    ParticipantsTable,
    SessionFormDialog,
    CancelSessionDialog,
    FollowUpDialog,
    ToastModule,
    TagModule,
  ],
  providers: [SessionsDetailStore, MessageService],
  templateUrl: './session-detail.html',
  styleUrl: './session-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstructorSessionDetail implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _msg = inject(MessageService);
  protected readonly store = inject(SessionsDetailStore);
  // Root-scoped — reload after cancel so the list page reflects the new tab on next visit.
  private readonly _listStore = inject(SessionsInstructorStore);

  readonly editOpen = signal(false);
  readonly cancelOpen = signal(false);
  readonly messageOpen = signal(false);

  ngOnInit(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (id) this.store.load(id);
  }

  protected readonly isOnline = computed(
    () => this.store.template()?.locationKind === 'ONLINE',
  );

  protected readonly canApprove = computed(
    () => this.store.template()?.approvalRequired === true,
  );

  // Confirmed + pending-approval both count — "running late" still helps people awaiting approval.
  protected readonly canMessageParticipants = computed(() => {
    const i = this.store.instance();
    if (!i) return false;
    return i.confirmedCount + i.pendingApprovalCount > 0;
  });

  protected statusLabel(status: string): string {
    switch (status) {
      case 'CANCELLED':
        return 'Cancelled';
      case 'COMPLETED':
        return 'Completed';
      default:
        return status;
    }
  }

  protected approve(participantId: string): void {
    this.store.approve(participantId);
  }
  protected decline(participantId: string): void {
    this.store.decline(participantId);
  }

  protected copyMeetingUrl(inst: SessionInstance, tpl: SessionTemplate | null): void {
    const url = inst.meetingUrlOverride ?? tpl?.meetingUrl;
    if (!url) return;
    navigator.clipboard.writeText(url).then(
      () => this._msg.add({ severity: 'success', summary: 'Meeting link copied' }),
      () => this._msg.add({ severity: 'warn', summary: 'Could not copy', detail: url }),
    );
  }

  protected onSessionSaved(): void {
    this.editOpen.set(false);
    this.store.reload();
    // Edit may change tab placement (e.g. ended → active) — refresh list.
    this._listStore.reload();
  }

  protected onCancelled(): void {
    this.cancelOpen.set(false);
    this.store.reload();
    // Cancel moves the instance from Upcoming → Cancelled. Refresh the
    // list store so the user sees the correct tab next time they visit.
    this._listStore.reload();
  }
}
