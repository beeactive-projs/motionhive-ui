import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { SkeletonModule } from 'primeng/skeleton';
import { Venue, VenueService, showApiError } from 'core';
import { VenueCard } from '../../../../instructor/venues/venue-card/venue-card';
import { VenueFormDialog } from '../../../../instructor/venues/venue-form-dialog/venue-form-dialog';

/**
 * Venues section for the profile Coaching card. Owns the list state,
 * the form dialog, and the archive/restore/delete confirms — kept out
 * of the much larger `Details` component so each part has one job.
 *
 * The parent only needs to mount `<mh-venues-section />` inside the
 * "Coaching profile" card when the user has an instructor profile.
 */
@Component({
  selector: 'mh-venues-section',
  imports: [
    ButtonModule,
    ConfirmDialog,
    SkeletonModule,
    VenueCard,
    VenueFormDialog,
  ],
  providers: [ConfirmationService],
  templateUrl: './venues-section.html',
  styleUrl: './venues-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VenuesSection implements OnInit {
  private readonly _venueService = inject(VenueService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);

  readonly venues = signal<Venue[]>([]);
  readonly venuesLoading = signal(false);
  readonly venueDialogVisible = signal(false);
  readonly editingVenue = signal<Venue | null>(null);

  readonly activeVenues = computed(() =>
    this.venues().filter((v) => v.isActive),
  );
  readonly archivedVenues = computed(() =>
    this.venues().filter((v) => !v.isActive),
  );

  ngOnInit(): void {
    this.loadVenues();
  }

  private loadVenues(): void {
    this.venuesLoading.set(true);
    this._venueService.list().subscribe({
      next: (items) => {
        this.venues.set(items);
        this.venuesLoading.set(false);
      },
      error: (err: unknown) => {
        this.venuesLoading.set(false);
        showApiError(
          this._messageService,
          'Could not load venues',
          'Please try again.',
          err,
        );
      },
    });
  }

  openVenueCreate(): void {
    this.editingVenue.set(null);
    this.venueDialogVisible.set(true);
  }

  openVenueEdit(venue: Venue): void {
    this.editingVenue.set(venue);
    this.venueDialogVisible.set(true);
  }

  onVenueSaved(venue: Venue): void {
    this.venues.update((list) => {
      const idx = list.findIndex((v) => v.id === venue.id);
      if (idx === -1) return [venue, ...list];
      const next = [...list];
      next[idx] = venue;
      return next;
    });
  }

  confirmVenueArchive(venue: Venue): void {
    this._confirmationService.confirm({
      header: 'Archive venue?',
      message: `"${venue.name}" will be hidden from new sessions but existing sessions keep showing it. You can restore it later.`,
      icon: 'pi pi-inbox',
      acceptLabel: 'Archive',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-sm',
      rejectButtonStyleClass: 'p-button-sm p-button-text',
      accept: () => this.archiveVenue(venue),
    });
  }

  private archiveVenue(venue: Venue): void {
    this._venueService.archive(venue.id).subscribe({
      next: () => {
        this.venues.update((list) =>
          list.map((v) => (v.id === venue.id ? { ...v, isActive: false } : v)),
        );
        this._messageService.add({
          severity: 'success',
          summary: 'Venue archived',
        });
      },
      error: (err: unknown) => {
        showApiError(
          this._messageService,
          'Could not archive venue',
          'Please try again.',
          err,
        );
      },
    });
  }

  confirmVenueRestore(venue: Venue): void {
    this._confirmationService.confirm({
      header: 'Restore venue?',
      message: `"${venue.name}" will be visible again and selectable when you create new sessions.`,
      icon: 'pi pi-refresh',
      acceptLabel: 'Restore',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-sm',
      rejectButtonStyleClass: 'p-button-sm p-button-text',
      accept: () => this.restoreVenue(venue),
    });
  }

  private restoreVenue(venue: Venue): void {
    this._venueService.update(venue.id, { isActive: true }).subscribe({
      next: (updated) => {
        this.venues.update((list) =>
          list.map((v) => (v.id === updated.id ? updated : v)),
        );
        this._messageService.add({
          severity: 'success',
          summary: 'Venue restored',
        });
      },
      error: (err: unknown) => {
        showApiError(
          this._messageService,
          'Could not restore venue',
          'Please try again.',
          err,
        );
      },
    });
  }

  confirmVenueRemove(venue: Venue): void {
    this._confirmationService.confirm({
      header: 'Delete venue?',
      message: `"${venue.name}" will be removed. Historical sessions keep their details.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-sm p-button-danger',
      rejectButtonStyleClass: 'p-button-sm p-button-text',
      accept: () => this.removeVenue(venue),
    });
  }

  private removeVenue(venue: Venue): void {
    this._venueService.remove(venue.id).subscribe({
      next: () => {
        this.venues.update((list) => list.filter((v) => v.id !== venue.id));
        this._messageService.add({
          severity: 'success',
          summary: 'Venue deleted',
        });
      },
      error: (err: unknown) => {
        showApiError(
          this._messageService,
          'Could not delete venue',
          'Please try again.',
          err,
        );
      },
    });
  }
}
