import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSkeletonText,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { Observable } from 'rxjs';

import { Venue } from 'core';

import {
  VENUE_ACTIONS,
  VENUE_ICONS,
  VenueActionId,
  VenueActionIds,
  VenueDraft,
  VenueRowLine,
  venueCreatePayload,
  venueRowLine,
  venueUpdatePayload,
} from '../../config/venues.config';
import { CoachVenuesStore } from '../../services/coach-venues.store';
import { FeedbackService } from '../../services/feedback.service';
import { ActionSheet } from '../action-sheet/action-sheet';
import { ConfirmSheet } from '../confirm-sheet/confirm-sheet';
import { HexAvatar } from '../hex-avatar/hex-avatar';
import { VenueSheet } from '../venue-sheet/venue-sheet';

/** One place in the list with how its second line reads. */
interface VenueRow {
  venue: Venue;
  line: VenueRowLine;
}

/**
 * The places a coach works from, editable where they are listed: the
 * welcome flow's coach step and the coaching profile show the same list from
 * `CoachVenuesStore`, so a place added in one is in the other.
 *
 * A row opens the place to change it; its ⋯ offers Edit details and Remove
 * (red, last, confirmed). The last row adds a place. Each change is sent at
 * once: the sheet stays open and filled in until the API has it, and a
 * failure leaves it open with a toast.
 */
@Component({
  selector: 'mh-venue-list',
  imports: [
    ActionSheet,
    ConfirmSheet,
    HexAvatar,
    IonButton,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonSkeletonText,
    TranslatePipe,
    VenueSheet,
  ],
  templateUrl: './venue-list.html',
  styleUrl: './venue-list.scss',
})
export class VenueList implements OnInit {
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);

  readonly store = inject(CoachVenuesStore);
  readonly actions = VENUE_ACTIONS;

  readonly rows = computed<VenueRow[]>(() =>
    this.store.active().map((venue) => ({ venue, line: venueRowLine(venue) })),
  );

  /** The first load is on its way: a placeholder row instead of an empty list. */
  readonly pending = computed(() => !this.store.loaded() && !this.store.failed());

  readonly sheetOpen = signal(false);
  /** The place the sheet changes, or null while adding one. */
  readonly editing = signal<Venue | null>(null);
  readonly saving = signal(false);

  readonly actionsOpen = signal(false);
  /** The place whose ⋯ was pressed. */
  readonly target = signal<Venue | null>(null);
  readonly targetName = computed(() => {
    const venue = this.target();
    if (!venue) {
      return '';
    }
    return venue.name;
  });

  readonly removeOpen = signal(false);
  readonly removing = signal(false);

  constructor() {
    addIcons(VENUE_ICONS);
  }

  ngOnInit(): void {
    this.store.ensureLoaded();
  }

  retry(): void {
    this.store.reload();
  }

  /** "Gym · Cluj-Napoca", "Online · Zoom", "At clients' homes". */
  lineText(line: VenueRowLine): string {
    const kind = this._translateService.instant(line.kindLabel);
    if (!line.detail) {
      return kind;
    }
    let detail = line.detail;
    if (line.detailIsKey) {
      detail = this._translateService.instant(line.detail);
    }
    return `${kind} · ${detail}`;
  }

  add(): void {
    this.editing.set(null);
    this.sheetOpen.set(true);
  }

  edit(venue: Venue): void {
    this.editing.set(venue);
    this.sheetOpen.set(true);
  }

  more(event: Event, venue: Venue): void {
    // Inside the row's own tap target; without this the row opens too.
    event.stopPropagation();
    this.target.set(venue);
    this.actionsOpen.set(true);
  }

  onAction(id: VenueActionId): void {
    const venue = this.target();
    if (!venue) {
      return;
    }
    if (id === VenueActionIds.Edit) {
      this.edit(venue);
      return;
    }
    if (id === VenueActionIds.Remove) {
      this.removeOpen.set(true);
    }
  }

  save(draft: VenueDraft): void {
    if (this.saving()) {
      return;
    }
    const editing = this.editing();
    let request: Observable<Venue>;
    let done = 'venues.toast.added';
    if (editing) {
      request = this.store.update(editing.id, venueUpdatePayload(draft));
      done = 'venues.toast.updated';
    } else {
      request = this.store.create(venueCreatePayload(draft));
    }
    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.sheetOpen.set(false);
        void this._feedbackService.success(this._translateService.instant(done));
      },
      error: (error: unknown) => {
        this.saving.set(false);
        void this._feedbackService.error(
          error,
          this._translateService.instant('venues.toast.saveFailed'),
        );
      },
    });
  }

  remove(): void {
    const venue = this.target();
    if (!venue || this.removing()) {
      return;
    }
    this.removing.set(true);
    this.store.remove(venue.id).subscribe({
      next: () => {
        this.removing.set(false);
        this.removeOpen.set(false);
        this.target.set(null);
        void this._feedbackService.success(
          this._translateService.instant('venues.toast.removed'),
        );
      },
      error: (error: unknown) => {
        this.removing.set(false);
        void this._feedbackService.error(
          error,
          this._translateService.instant('venues.toast.removeFailed'),
        );
      },
    });
  }
}
