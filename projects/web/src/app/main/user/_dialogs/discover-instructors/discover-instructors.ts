import { Component, effect, model, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonDirective } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { TextareaModule } from 'primeng/textarea';
import { MessageService } from 'primeng/api';
import {
  AuthStore,
  InstructorSearchResult,
  ClientService,
  ProfileService,
  showApiError,
} from 'core';
import { Avatar } from '../../../../_shared/components/avatar/avatar';

@Component({
  selector: 'mh-discover-instructors',
  imports: [
    FormsModule,
    DialogModule,
    ButtonDirective,
    InputTextModule,
    Avatar,
    SkeletonModule,
    ToastModule,
    TextareaModule,
    TranslatePipe,
  ],
  providers: [MessageService],
  templateUrl: './discover-instructors.html',
  styleUrl: './discover-instructors.scss',
})
export class DiscoverInstructors {
  private readonly _profileService = inject(ProfileService);
  private readonly _clientService = inject(ClientService);
  private readonly _messageService = inject(MessageService);
  private readonly _authStore = inject(AuthStore);
  private readonly _translateService = inject(TranslateService);

  readonly visible = model(false);

  private readonly _autoSearchEffect = effect(() => {
    if (this.visible()) {
      const city = this._authStore.user()?.city;
      if (city) {
        this.searchQuery.set(city);
        this.search();
      }
    }
  });

  readonly searchQuery = signal('');
  readonly results = signal<InstructorSearchResult[]>([]);
  readonly searching = signal(false);
  readonly searched = signal(false);

  readonly requestingId = signal<string | null>(null);
  readonly showRequestDialog = signal(false);
  readonly selectedInstructor = signal<InstructorSearchResult | null>(null);
  readonly requestMessage = signal('');

  search(): void {
    this.searching.set(true);
    this.searched.set(false);
    this._profileService.discoverInstructors(this.searchQuery() || undefined).subscribe({
      next: (data) => {
        this.results.set(data);
        this.searching.set(false);
        this.searched.set(true);
      },
      error: () => {
        this.searching.set(false);
        this.searched.set(true);
        this._messageService.add({
          severity: 'error',
          summary: this._translateService.instant('toast.summary.error'),
          detail: this._translateService.instant('userDialogs.discoverCoaches.toast.searchFailed'),
        });
      },
    });
  }

  openRequestDialog(instructor: InstructorSearchResult): void {
    this.selectedInstructor.set(instructor);
    this.requestMessage.set('');
    this.showRequestDialog.set(true);
  }

  sendRequest(): void {
    const instructor = this.selectedInstructor();
    if (!instructor) return;

    this.requestingId.set(instructor.userId);
    this._clientService
      .requestToBeClient(instructor.userId, this.requestMessage() || undefined)
      .subscribe({
        next: () => {
          this.requestingId.set(null);
          this.showRequestDialog.set(false);
          this._messageService.add({
            severity: 'success',
            summary: this._translateService.instant('userDialogs.discoverCoaches.toast.requestSent.summary'),
            detail: this._translateService.instant('userDialogs.discoverCoaches.toast.requestSent.detail', {
              name: this.instructorName(instructor),
            }),
          });
        },
        error: (err) => {
          this.requestingId.set(null);
          showApiError(
            this._messageService,
            this._translateService.instant('toast.summary.error'),
            this._translateService.instant('userDialogs.discoverCoaches.toast.requestFailed'),
            err,
          );
        },
      });
  }

  instructorName(instructor: InstructorSearchResult): string {
    return instructor.displayName || `${instructor.firstName} ${instructor.lastName}`.trim();
  }

  initials(instructor: InstructorSearchResult): string {
    const name = this.instructorName(instructor);
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join('');
  }

  onHide(): void {
    this.searchQuery.set('');
    this.results.set([]);
    this.searched.set(false);
  }
}
