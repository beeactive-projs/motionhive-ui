import {
  ChangeDetectionStrategy,
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
import { ClientRequest, ClientService, MyInstructor } from 'core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { DiscoverInstructors } from '../../../user/_dialogs/discover-instructors/discover-instructors';

@Component({
  selector: 'mh-profile-coaches',
  imports: [
    AvatarModule,
    ButtonModule,
    CardModule,
    ConfirmDialog,
    SkeletonModule,
    ToastModule,
    TooltipModule,
    DiscoverInstructors,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './coaches.html',
  styleUrl: './coaches.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileCoaches implements OnInit {
  private readonly _clientService = inject(ClientService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _route = inject(ActivatedRoute);

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
          summary: 'Error',
          detail: 'Failed to load coaches',
        });
      },
    });
  }

  loadPendingRequests(): void {
    this.loadingRequests.set(true);
    this._clientService.getPendingRequests().subscribe({
      next: (requests) => {
        this.incomingRequests.set(
          requests.filter((r) => r.type === 'INSTRUCTOR_TO_CLIENT'),
        );
        this.outgoingRequests.set(
          requests.filter((r) => r.type === 'CLIENT_TO_INSTRUCTOR'),
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
          summary: 'Request accepted',
          detail: 'You are now working with this coach.',
        });
        this.loadPendingRequests();
        this.loadInstructors();
      },
      error: (err) => {
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'Failed to accept request',
        });
      },
    });
  }

  confirmDecline(request: ClientRequest): void {
    const name = this.requestFromName(request);
    this._confirmationService.confirm({
      message: `Decline the request from ${name}?`,
      header: 'Decline request',
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
          summary: 'Request declined',
        });
        this.loadPendingRequests();
      },
      error: (err) => {
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'Failed to decline request',
        });
      },
    });
  }

  confirmCancelOutgoing(request: ClientRequest): void {
    const name = this.requestToName(request);
    this._confirmationService.confirm({
      message: `Cancel your request to ${name}?`,
      header: 'Cancel request',
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
          summary: 'Request cancelled',
        });
        this.loadPendingRequests();
      },
      error: (err) => {
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'Failed to cancel request',
        });
      },
    });
  }

  confirmLeave(item: MyInstructor): void {
    const name = `${item.instructor.firstName} ${item.instructor.lastName}`;
    this._confirmationService.confirm({
      message: `End your collaboration with ${name}? You can send a new request later if you change your mind. Active memberships continue until you cancel them from the Memberships tab.`,
      header: 'End collaboration',
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
          summary: 'Collaboration ended',
        });
        this.loadInstructors();
      },
      error: (err) => {
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'Failed to end relationship',
        });
      },
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
    if (!request.fromUser) return 'A coach';
    return `${request.fromUser.firstName} ${request.fromUser.lastName}`;
  }

  requestToName(request: ClientRequest): string {
    if (!request.toUser) return 'Unknown';
    return `${request.toUser.firstName} ${request.toUser.lastName}`;
  }

  trackById = (_: number, item: { id: string }) => item.id;
}
