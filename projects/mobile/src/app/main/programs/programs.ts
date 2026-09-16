import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import { Program, ProgramSize, ProgramSizes } from 'core';

import { EmptyState } from '../../_shared/components/empty-state/empty-state';
import { NotificationBell } from '../../_shared/components/notification-bell/notification-bell';
import { SessionRowSkeleton } from '../../_shared/components/session-row-skeleton/session-row-skeleton';
import { ProgramRow } from './_components/program-row/program-row';
import { CreateSheet } from './_sheets/create-sheet/create-sheet';
import { CreateChoice, CreateChoices, LIBRARY_PILLS, PROGRAM_ICONS } from './programs.config';
import { ProgramsStore } from './programs.store';

/**
 * The library — everything this coach has authored, programs and routines
 * together.
 *
 * One list rather than two tabs: they are the same entity at two sizes, and
 * splitting them would make "where did I put that?" a question about a
 * distinction the author does not think in. The pills narrow; the spine
 * colour says which is which at a glance.
 */
@Component({
  selector: 'mh-programs',
  imports: [
    CreateSheet,
    EmptyState,
    IonButton,
    IonButtons,
    IonChip,
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    IonTitle,
    IonToolbar,
    NotificationBell,
    ProgramRow,
    SessionRowSkeleton,
  ],
  providers: [ProgramsStore],
  templateUrl: './programs.html',
  styleUrl: './programs.scss',
})
export class Programs implements ViewWillEnter {
  readonly store = inject(ProgramsStore);
  private readonly _router = inject(Router);

  readonly skeletonRows = [1, 2, 3, 4];
  readonly pills = LIBRARY_PILLS;
  readonly Choices = CreateChoices;
  readonly Sizes = ProgramSizes;

  readonly createOpen = signal(false);

  constructor() {
    addIcons(PROGRAM_ICONS);
  }

  // Not ngOnInit: Ionic keeps the page in its tab stack, so a program saved
  // on another screen would not show up here.
  ionViewWillEnter(): void {
    this.store.load();
  }

  onRefresh(event: RefresherCustomEvent): void {
    this.store.load({ done: () => void event.target.complete() });
  }

  retry(): void {
    this.store.load();
  }

  setSize(size: ProgramSize): void {
    this.store.setSize(size);
  }

  countFor(size: ProgramSize): number {
    return this.store.counts()[size];
  }

  open(program: Program): void {
    // A routine is the round-1 builder; a program is the week grid.
    const path = program.isSingleWorkout ? 'routine' : 'program';
    void this._router.navigate(['/tabs/programs', path, program.id]);
  }

  openCreate(): void {
    this.createOpen.set(true);
  }

  onCreate(choice: CreateChoice): void {
    if (choice === CreateChoices.Starters) {
      void this._router.navigate(['/tabs/workouts/starters']);
      return;
    }
    void this._router.navigate(['/tabs/programs', choice, 'new']);
  }
}
