import { Component, ChangeDetectionStrategy, model, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { AvatarModule } from 'primeng/avatar';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { TextareaModule } from 'primeng/textarea';
import { MessageService } from 'primeng/api';
import { InstructorSearchResult, ClientService, ProfileService } from 'core';

@Component({
  selector: 'mh-discover-instructors',
  imports: [
    FormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    AvatarModule,
    SkeletonModule,
    ToastModule,
    TextareaModule,
  ],
  providers: [MessageService],
  templateUrl: './discover-instructors.html',
  styleUrl: './discover-instructors.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscoverInstructors {
  private readonly _profileService = inject(ProfileService);
  private readonly _clientService = inject(ClientService);
  private readonly _messageService = inject(MessageService);

  readonly visible = model(false);

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
          summary: 'Error',
          detail: 'Failed to search instructors',
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

    this.requestingId.set(instructor.id);
    this._clientService
      .requestToBeClient(instructor.id, this.requestMessage() || undefined)
      .subscribe({
        next: () => {
          this.requestingId.set(null);
          this.showRequestDialog.set(false);
          this._messageService.add({
            severity: 'success',
            summary: 'Request Sent',
            detail: `Your request to join ${this.instructorName(instructor)} was sent successfully`,
          });
        },
        error: (err) => {
          this.requestingId.set(null);
          this._messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err.error?.message || 'Failed to send request',
          });
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
