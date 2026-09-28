import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';
import { ButtonDirective } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import {
  MyInstructor,
  ClientRequest,
  ClientRequestTypes,
  ClientService,
  escapeHtml,
  showApiError,
} from 'core';
import { DiscoverInstructors } from '../_dialogs/discover-instructors/discover-instructors';
import { Avatar } from '../../../_shared/components/avatar/avatar';
import { UserInfo } from '../../../_shared/components/user-info/user-info';
import { ListEmptyState } from '../../../_shared/components/list-empty-state/list-empty-state';

@Component({
  selector: 'mh-instructors',
  imports: [
    CardModule,
    ButtonDirective,
    TableModule,
    Avatar,
    UserInfo,
    SkeletonModule,
    ToastModule,
    TooltipModule,
    ConfirmDialogModule,
    DiscoverInstructors,
    ListEmptyState,
    TranslatePipe,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './instructors.html',
  styleUrl: './instructors.scss',
})
export class Instructors implements OnInit {
  private readonly _clientService = inject(ClientService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _translateService = inject(TranslateService);

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
    this._clientService.getMyInstructors().subscribe({
      next: (items) => {
        this.instructors.set(items);
        this.totalRecords.set(items.length);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this._messageService.add({
          severity: 'error',
          summary: this._translateService.instant('toast.summary.error'),
          detail: this._translateService.instant('myCoaches.toast.loadFailed'),
        });
      },
    });
  }

  loadPendingRequests(): void {
    this._clientService.getPendingRequests().subscribe({
      next: (requests) =>
        this.pendingRequests.set(requests.filter((r) => r.type === ClientRequestTypes.ClientToInstructor)),
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
      : this._translateService.instant('myCoaches.confirm.cancel.thisCoach');
    this._confirmationService.confirm({
      message: this._translateService.instant('myCoaches.confirm.cancel.message', {
        name: escapeHtml(name),
      }),
      header: this._translateService.instant('myCoaches.confirm.cancel.header'),
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
          summary: this._translateService.instant('toast.summary.requestCancelled'),
          detail: this._translateService.instant('myCoaches.toast.cancelled.detail'),
        });
        this.loadPendingRequests();
      },
      error: (err) => {
        showApiError(
          this._messageService,
          this._translateService.instant('toast.summary.error'),
          this._translateService.instant('myCoaches.toast.cancelFailed'),
          err,
        );
      },
    });
  }

  initials(item: MyInstructor): string {
    return [item.instructor.firstName, item.instructor.lastName].map((w) => w.charAt(0)).join('');
  }

  requestToName(request: ClientRequest): string {
    if (!request.toUser) return this._translateService.instant('common.unknown');
    return `${request.toUser.firstName} ${request.toUser.lastName}`;
  }

  trackByEmail = (_: number, item: MyInstructor) => item.instructor.email;
  trackById = (_: number, item: { id: string }) => item.id;
}
