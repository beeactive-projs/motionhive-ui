import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { MessageModule } from 'primeng/message';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  ActionItem,
  ActionList,
  BottomSheet,
  SessionInstance,
  SessionInstanceStatus,
  SessionLocationKind,
  SessionTemplate,
  SessionsDetailStore,
  SessionsInstructorStore,
  injectIsMobile,
  injectIsTablet,
} from 'core';
import { AccessChip } from '../../../../_shared/components/access-chip/access-chip';
import { TypeChip } from '../../../../_shared/components/type-chip/type-chip';
import { CapacityBar } from '../../../../_shared/components/capacity-bar/capacity-bar';
import { ParticipantsTable } from '../../../../_shared/components/participants-table/participants-table';
import { ProviderChip } from '../../../../_shared/components/provider-chip/provider-chip';
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
    AccessChip,
    TypeChip,
    ProviderChip,
    CapacityBar,
    ParticipantsTable,
    SessionFormDialog,
    CancelSessionDialog,
    FollowUpDialog,
    MessageModule,
    ToastModule,
    TagModule,
    ActionList,
    BottomSheet,
  ],
  providers: [SessionsDetailStore, MessageService],
  templateUrl: './session-detail.html',
  styleUrl: './session-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstructorSessionDetail implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _location = inject(Location);
  private readonly _messageService = inject(MessageService);
  protected readonly store = inject(SessionsDetailStore);
  // Root-scoped — reload after cancel so the list page reflects the new tab on next visit.
  private readonly _listStore = inject(SessionsInstructorStore);

  readonly editOpen = signal(false);
  readonly cancelOpen = signal(false);
  readonly messageOpen = signal(false);
  /** Mobile overflow sheet (Edit / Message / Cancel / Copy link). */
  readonly actionsOpen = signal(false);

  protected readonly isMobile = injectIsMobile();
  protected readonly isTablet = injectIsTablet();

  // Enum consts exposed for template comparisons — never compare against
  // raw string literals (see CLAUDE.md).
  protected readonly SessionStatus = SessionInstanceStatus;

  ngOnInit(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (id) this.store.load(id);
  }

  protected readonly isOnline = computed(
    () => this.store.template()?.locationKind === SessionLocationKind.Online,
  );

  // Confirmed + pending-approval both count — "running late" still helps people awaiting approval.
  protected readonly canMessageParticipants = computed(() => {
    const i = this.store.instance();
    if (!i) return false;
    return i.confirmedCount + i.pendingApprovalCount > 0;
  });

  protected statusLabel(status: SessionInstanceStatus): string {
    switch (status) {
      case SessionInstanceStatus.Cancelled:
        return 'Cancelled';
      case SessionInstanceStatus.Completed:
        return 'Completed';
      default:
        return status;
    }
  }

  protected goBack(): void {
    // Location.back() === history.back(). If we arrived via deep link or a
    // refresh there's no in-app history to pop, so fall back to the list.
    if (this._router.lastSuccessfulNavigation()?.previousNavigation) {
      this._location.back();
    } else {
      void this._router.navigate(['/coaching/sessions']);
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
      () => this._messageService.add({ severity: 'success', summary: 'Meeting link copied' }),
      () => this._messageService.add({ severity: 'warn', summary: 'Could not copy', detail: url }),
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

  // ─── Mobile overflow sheet ───────────────────────────────────────

  /** Open the mobile action sheet — equivalent to the desktop header buttons. */
  protected openActionsSheet(): void {
    this.actionsOpen.set(true);
  }

  protected closeActionsSheet(): void {
    this.actionsOpen.set(false);
  }

  /**
   * Action-sheet rows for the session-detail ⋮ menu. Computed because
   * the available verbs depend on status (SCHEDULED vs CANCELLED /
   * COMPLETED) and on whether the session is online (Copy meeting
   * link is gated). Cancelled / completed sessions only get the
   * "Open calendar" escape hatch — everything else is read-only.
   */
  protected readonly detailActions = computed<ActionItem[]>(() => {
    const i = this.store.instance();
    if (!i) return [];
    if (i.status !== SessionInstanceStatus.Scheduled) {
      return [{ id: 'calendar', icon: 'pi pi-calendar', label: 'Open calendar' }];
    }
    const items: ActionItem[] = [];
    if (this.canMessageParticipants()) {
      items.push({ id: 'message', icon: 'pi pi-send', label: 'Message participants' });
    }
    if (this.isOnline()) {
      items.push({ id: 'copy-link', icon: 'pi pi-copy', label: 'Copy meeting link' });
    }
    items.push({ id: 'edit', icon: 'pi pi-pencil', label: 'Edit session' });
    items.push({ id: 'calendar', icon: 'pi pi-calendar', label: 'Open calendar' });
    items.push({ id: 'cancel', icon: 'pi pi-times', label: 'Cancel session…', danger: true });
    return items;
  });

  protected onDetailAction(
    item: ActionItem,
    inst: SessionInstance,
    tpl: SessionTemplate,
  ): void {
    this.closeActionsSheet();
    switch (item.id) {
      case 'message':
        this.messageOpen.set(true);
        break;
      case 'copy-link':
        this.copyMeetingUrl(inst, tpl);
        break;
      case 'edit':
        this.editOpen.set(true);
        break;
      case 'calendar':
        void this._router.navigate(['/coaching/sessions/calendar']);
        break;
      case 'cancel':
        this.cancelOpen.set(true);
        break;
    }
  }
}
