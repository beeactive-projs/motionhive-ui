import {
  Component,
  computed,
  effect,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  ClientRequest,
  ClientRequestTypes,
  ClientService,
  escapeHtml,
  MyInstructor,
  showApiError,
} from 'core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { DiscoverInstructors } from '../../../user/_dialogs/discover-instructors/discover-instructors';
import { Avatar } from '../../../../_shared/components/avatar/avatar';

@Component({
  selector: 'mh-profile-coaches',
  imports: [
    Avatar,
    ButtonDirective,
    CardModule,
    ConfirmDialog,
    SkeletonModule,
    ToastModule,
    TooltipModule,
    TranslatePipe,
    DiscoverInstructors,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './coaches.html',
  styleUrl: './coaches.scss',
})
export class ProfileCoaches implements OnInit {
  private readonly _clientService = inject(ClientService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _translateService = inject(TranslateService);

  readonly active = input(false);

  readonly instructors = signal<MyInstructor[]>([]);
  readonly loadingInstructors = signal(true);

  readonly incomingRequests = signal<ClientRequest[]>([]);
  readonly outgoingRequests = signal<ClientRequest[]>([]);
  readonly loadingRequests = signal(true);

  readonly discoverVisible = signal(false);

  readonly incomingCount = computed(() => this.incomingRequests().length);
  readonly outgoingCount = computed(() => this.outgoingRequests().length);

  private readonly _highlightedRequestId = toSignal(
    this._route.queryParamMap,
    { initialValue: this._route.snapshot.queryParamMap },
  );

  readonly highlightedRequestId = computed(
    () => this._highlightedRequestId().get('requestId'),
  );

  private readonly _scrollToHighlighted = effect(() => {
    const id = this.highlightedRequestId();
    if (!id || this.loadingRequests()) return;
    queueMicrotask(() => {
      const el = document.getElementById(`request-row-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  ngOnInit(): void {
    this.loadInstructors();
    this.loadPendingRequests();
  }

  loadInstructors(): void {
    this.loadingInstructors.set(true);
    this._clientService.getMyInstructors().subscribe({
      next: (items) => {
        this.instructors.set(items);
        this.loadingInstructors.set(false);
      },
      error: () => {
        this.loadingInstructors.set(false);
        this._messageService.add({
          severity: 'error',
          summary: this._translateService.instant('toast.summary.error'),
          detail: this._translateService.instant('profileTabs.coaches.toast.loadFailed'),
        });
      },
    });
  }

  loadPendingRequests(): void {
    this.loadingRequests.set(true);
    this._clientService.getPendingRequests().subscribe({
      next: (requests) => {
        this.incomingRequests.set(
          requests.filter((r) => r.type === ClientRequestTypes.InstructorToClient),
        );
        this.outgoingRequests.set(
          requests.filter((r) => r.type === ClientRequestTypes.ClientToInstructor),
        );
        this.loadingRequests.set(false);
      },
      error: () => {
        this.loadingRequests.set(false);
      },
    });
  }

  acceptRequest(request: ClientRequest): void {
    this._clientService.acceptRequest(request.id).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'success',
          summary: this._translateService.instant('profileTabs.coaches.toast.accepted.summary'),
          detail: this._translateService.instant('profileTabs.coaches.toast.accepted.detail'),
        });
        this.loadPendingRequests();
        this.loadInstructors();
      },
      error: (err) =>
        showApiError(
          this._messageService,
          this._translateService.instant('toast.summary.error'),
          this._translateService.instant('profileTabs.coaches.toast.acceptFailed'),
          err,
        ),
    });
  }

  confirmDecline(request: ClientRequest): void {
    const name = escapeHtml(this.requestFromName(request));
    this._confirmationService.confirm({
      message: this._translateService.instant('profileTabs.coaches.confirm.decline.message', { name }),
      header: this._translateService.instant('profileTabs.coaches.confirm.decline.header'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.declineRequest(request),
    });
  }

  private declineRequest(request: ClientRequest): void {
    this._clientService.declineRequest(request.id).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'info',
          summary: this._translateService.instant('profileTabs.coaches.toast.declined'),
        });
        this.loadPendingRequests();
      },
      error: (err) =>
        showApiError(
          this._messageService,
          this._translateService.instant('toast.summary.error'),
          this._translateService.instant('profileTabs.coaches.toast.declineFailed'),
          err,
        ),
    });
  }

  confirmCancelOutgoing(request: ClientRequest): void {
    const name = escapeHtml(this.requestToName(request));
    this._confirmationService.confirm({
      message: this._translateService.instant('profileTabs.coaches.confirm.cancel.message', { name }),
      header: this._translateService.instant('profileTabs.coaches.confirm.cancel.header'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.cancelOutgoing(request),
    });
  }

  private cancelOutgoing(request: ClientRequest): void {
    this._clientService.cancelRequest(request.id).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'info',
          summary: this._translateService.instant('toast.summary.requestCancelled'),
        });
        this.loadPendingRequests();
      },
      error: (err) =>
        showApiError(
          this._messageService,
          this._translateService.instant('toast.summary.error'),
          this._translateService.instant('profileTabs.coaches.toast.cancelFailed'),
          err,
        ),
    });
  }

  confirmLeave(item: MyInstructor): void {
    const name = escapeHtml(`${item.instructor.firstName} ${item.instructor.lastName}`);
    this._confirmationService.confirm({
      message: this._translateService.instant('profileTabs.coaches.confirm.leave.message', { name }),
      header: this._translateService.instant('profileTabs.coaches.confirm.leave.header'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.leaveInstructor(item),
    });
  }

  private leaveInstructor(item: MyInstructor): void {
    this._clientService.leaveInstructor(item.instructorId).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'success',
          summary: this._translateService.instant('profileTabs.coaches.toast.ended'),
        });
        this.loadInstructors();
      },
      error: (err) =>
        showApiError(
          this._messageService,
          this._translateService.instant('toast.summary.error'),
          this._translateService.instant('profileTabs.coaches.toast.endFailed'),
          err,
        ),
    });
  }

  instructorInitials(item: MyInstructor): string {
    return [item.instructor.firstName, item.instructor.lastName]
      .map((w) => w.charAt(0))
      .join('')
      .toUpperCase();
  }

  requestFromInitials(request: ClientRequest): string {
    const first = request.fromUser?.firstName?.charAt(0) ?? '';
    const last = request.fromUser?.lastName?.charAt(0) ?? '';
    return (first + last).toUpperCase() || '??';
  }

  requestFromName(request: ClientRequest): string {
    if (!request.fromUser) return this._translateService.instant('profileTabs.coaches.aCoach');
    return `${request.fromUser.firstName} ${request.fromUser.lastName}`;
  }

  requestToName(request: ClientRequest): string {
    if (!request.toUser) return this._translateService.instant('common.unknown');
    return `${request.toUser.firstName} ${request.toUser.lastName}`;
  }

  trackById = (_: number, item: { id: string }) => item.id;
}
