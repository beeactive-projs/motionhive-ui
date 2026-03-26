import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { AvatarModule } from 'primeng/avatar';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { MyInstructor, ClientRequest, ClientService } from 'core';
import { DiscoverInstructors } from '../dialogs/discover-instructors/discover-instructors';

@Component({
  selector: 'bee-instructors',
  imports: [
    CardModule,
    ButtonModule,
    TableModule,
    AvatarModule,
    SkeletonModule,
    ToastModule,
    TooltipModule,
    ConfirmDialogModule,
    DiscoverInstructors,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './instructors.html',
  styleUrl: './instructors.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Instructors implements OnInit {
  private readonly _clientService = inject(ClientService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);

  readonly instructors = signal<MyInstructor[]>([]);
  readonly totalRecords = signal(0);
  readonly loading = signal(true);
  readonly pendingRequests = signal<ClientRequest[]>([]);
  readonly discoverVisible = signal(false);

  readonly rows = 10;
  readonly currentPage = signal(1);

  readonly pendingCount = computed(() => this.pendingRequests().length);

  ngOnInit(): void {
    // this.loadInstructors();
    this.loadPendingRequests();
  }

  loadInstructors(): void {
    this.loading.set(true);
    this._clientService.getMyInstructors(this.currentPage(), this.rows).subscribe({
      next: (response) => {
        this.instructors.set(response.items);
        this.totalRecords.set(response.total);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this._messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load instructors',
        });
      },
    });
  }

  loadPendingRequests(): void {
    this._clientService.getPendingRequests().subscribe({
      next: (requests) =>
        this.pendingRequests.set(requests.filter((r) => r.type === 'CLIENT_TO_INSTRUCTOR')),
      error: () => {},
    });
  }

  onPageChange(event: { first?: number | null; rows?: number | null }): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.rows;
    this.currentPage.set(Math.floor(first / rows) + 1);
    this.loadInstructors();
  }

  confirmCancel(request: ClientRequest): void {
    const name = request.toUser
      ? `${request.toUser.firstName} ${request.toUser.lastName}`
      : 'this instructor';
    this._confirmationService.confirm({
      message: `Are you sure you want to cancel your request to ${name}?`,
      header: 'Cancel Request',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.cancelRequest(request),
    });
  }

  private cancelRequest(request: ClientRequest): void {
    this._clientService.cancelRequest(request.id).subscribe({
      next: () => {
        this._messageService.add({
          severity: 'info',
          summary: 'Request Cancelled',
          detail: 'Your request has been cancelled',
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

  initials(item: MyInstructor): string {
    return [item.instructor.firstName, item.instructor.lastName]
      .map((w) => w.charAt(0))
      .join('');
  }

  requestToName(request: ClientRequest): string {
    if (!request.toUser) return 'Unknown';
    return `${request.toUser.firstName} ${request.toUser.lastName}`;
  }

  trackByEmail = (_: number, item: MyInstructor) => item.instructor.email;
  trackById = (_: number, item: { id: string }) => item.id;
}
