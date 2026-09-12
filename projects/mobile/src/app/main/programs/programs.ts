import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';

import { Program, ProgramSize } from 'core';

import { EmptyState } from '../../_shared/components/empty-state/empty-state';
import { NotificationBell } from '../../_shared/components/notification-bell/notification-bell';
import { ProgramRow } from './_components/program-row/program-row';
import { CreateChoice, CreateSheet } from './_sheets/create-sheet/create-sheet';
import { PROGRAM_ICONS } from './programs.config';
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
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    NotificationBell,
    ProgramRow,
  ],
  providers: [ProgramsStore],
  templateUrl: './programs.html',
  styleUrl: './programs.scss',
})
export class Programs implements ViewWillEnter {
  readonly store = inject(ProgramsStore);
  private readonly _router = inject(Router);

  readonly skeletonRows = [1, 2, 3, 4];

  readonly pills: { id: ProgramSize; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'program', label: 'Programs' },
    { id: 'routine', label: 'Routines' },
  ];

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

  countFor(id: ProgramSize): number {
    return this.store.counts()[id];
  }

  open(program: Program): void {
    // A routine is the round-1 builder; a program is the week grid.
    const path = program.isSingleWorkout ? 'routine' : 'program';
    void this._router.navigate(['/tabs/programs', path, program.id]);
  }

  onCreate(choice: CreateChoice): void {
    if (choice === 'starters') {
      void this._router.navigate(['/tabs/workouts/starters']);
      return;
    }
    void this._router.navigate(['/tabs/programs', choice, 'new']);
  }

  retry(): void {
    this.store.load();
  }
}
