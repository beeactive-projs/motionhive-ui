import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSkeletonText,
  IonText,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { calendarOutline, checkmarkCircle, sparklesOutline } from 'ionicons/icons';

import { AuthStore, BlogPost, MARKETING_BLOG_URL } from 'core';

import { EmptyState } from '../../../_shared/components/empty-state/empty-state';
import { HexAvatar } from '../../../_shared/components/hex-avatar/hex-avatar';
import { SectionHeader } from '../../../_shared/components/section-header/section-header';
import { StartStep, TrainHomeStore } from './train-home.store';

@Component({
  selector: 'mh-train-home',
  imports: [
    EmptyState,
    HexAvatar,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSkeletonText,
    IonText,
    SectionHeader,
  ],
  templateUrl: './train-home.html',
  styleUrl: './train-home.scss',
  providers: [TrainHomeStore],
})
export class TrainHome implements OnInit, ViewWillEnter {
  private readonly _authStore = inject(AuthStore);
  private readonly _router = inject(Router);

  readonly store = inject(TrainHomeStore);

  readonly firstName = this._authStore.user;

  constructor() {
    addIcons({ calendarOutline, checkmarkCircle, sparklesOutline });
  }

  ngOnInit(): void {
    this.store.load();
  }

  /**
   * Ionic keeps tab pages alive, so `ngOnInit` fires once per stack entry and
   * never again — without this, completing your profile on another tab would
   * leave the checklist showing it undone forever.
   */
  ionViewWillEnter(): void {
    this.store.refresh();
  }

  greetingName(): string {
    return this.firstName()?.firstName?.trim() || 'there';
  }

  sessionsSummary(): string {
    const count = this.store.upcomingSessions();
    if (count === 0) return 'No sessions booked';
    return count === 1 ? '1 session booked' : `${count} sessions booked`;
  }

  sessionsHint(): string {
    return this.store.upcomingSessions() === 0
      ? 'Find a coach and book your first one.'
      : 'Browse what else is open to join.';
  }

  resumeWorkout(): void {
    void this._router.navigateByUrl('/tabs/workouts');
  }

  openStep(step: StartStep): void {
    if (step.done) return;
    void this._router.navigateByUrl(step.route);
  }

  /**
   * Both the sessions row and the coaches list land on Discover: booking and
   * coach detail are Discover surfaces, and neither has its own page yet.
   */
  openSessions(): void {
    void this._router.navigateByUrl('/tabs/discover');
  }

  openCoaches(): void {
    void this._router.navigateByUrl('/tabs/discover');
  }

  /**
   * Articles are only published on the marketing site and there is no in-app
   * reader yet, so hand off to the system browser. `_blank` does open
   * externally from a Capacitor WebView on both platforms.
   */
  openPost(post: BlogPost): void {
    window.open(`${MARKETING_BLOG_URL}/${post.slug}`, '_blank', 'noopener');
  }

  openBlog(): void {
    window.open(MARKETING_BLOG_URL, '_blank', 'noopener');
  }
}
