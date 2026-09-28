import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { SkeletonModule } from 'primeng/skeleton';
import { Venue, VenueService, escapeHtml, showApiError } from 'core';
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
    ConfirmDialog,
    SkeletonModule,
    VenueCard,
    VenueFormDialog,
    TranslatePipe,
  ],
  providers: [ConfirmationService],
  templateUrl: './venues-section.html',
  styleUrl: './venues-section.scss',
})
export class VenuesSection implements OnInit {
  private readonly _venueService = inject(VenueService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _translateService = inject(TranslateService);

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
          this._translateService.instant('venues.toast.loadFailed'),
          this._translateService.instant('common.pleaseTryAgain'),
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
      header: this._translateService.instant('venues.confirm.archive.header'),
      message: this._translateService.instant('venues.confirm.archive.message', {
        name: escapeHtml(venue.name),
      }),
      icon: 'pi pi-inbox',
      acceptLabel: this._translateService.instant('button.archive'),
      rejectLabel: this._translateService.instant('button.cancel'),
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
          summary: this._translateService.instant('venues.toast.archived'),
        });
      },
      error: (err: unknown) => {
        showApiError(
          this._messageService,
          this._translateService.instant('venues.toast.archiveFailed'),
          this._translateService.instant('common.pleaseTryAgain'),
          err,
        );
      },
    });
  }

  confirmVenueRestore(venue: Venue): void {
    this._confirmationService.confirm({
      header: this._translateService.instant('venues.confirm.restore.header'),
      message: this._translateService.instant('venues.confirm.restore.message', {
        name: escapeHtml(venue.name),
      }),
      icon: 'pi pi-refresh',
      acceptLabel: this._translateService.instant('button.restore'),
      rejectLabel: this._translateService.instant('button.cancel'),
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
          summary: this._translateService.instant('venues.toast.restored'),
        });
      },
      error: (err: unknown) => {
        showApiError(
          this._messageService,
          this._translateService.instant('venues.toast.restoreFailed'),
          this._translateService.instant('common.pleaseTryAgain'),
          err,
        );
      },
    });
  }

  confirmVenueRemove(venue: Venue): void {
    this._confirmationService.confirm({
      header: this._translateService.instant('venues.confirm.delete.header'),
      message: this._translateService.instant('venues.confirm.delete.message', {
        name: escapeHtml(venue.name),
      }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this._translateService.instant('button.delete'),
      rejectLabel: this._translateService.instant('button.cancel'),
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
          summary: this._translateService.instant('venues.toast.deleted'),
        });
      },
      error: (err: unknown) => {
        showApiError(
          this._messageService,
          this._translateService.instant('venues.toast.deleteFailed'),
          this._translateService.instant('common.pleaseTryAgain'),
          err,
        );
      },
    });
  }
}
