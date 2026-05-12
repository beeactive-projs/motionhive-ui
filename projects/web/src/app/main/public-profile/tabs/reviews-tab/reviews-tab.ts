import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { PublicProfileStore } from 'core';
import { Card } from 'primeng/card';
import { Button } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { RatingBreakdown } from './rating-breakdown/rating-breakdown';
import { ReviewRow } from './review-row/review-row';

@Component({
  selector: 'mh-public-profile-reviews-tab',
  imports: [Card, Button, SkeletonModule, RatingBreakdown, ReviewRow],
  templateUrl: './reviews-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewsTab implements OnInit {
  private readonly _store = inject(PublicProfileStore);

  readonly reviews = this._store.reviews;
  readonly breakdown = this._store.reviewsBreakdown;
  readonly hasMore = this._store.hasMoreReviews;
  readonly loading = this._store.loadingReviews;

  ngOnInit(): void {
    this._store.loadReviews();
  }

  onLoadMore(): void {
    this._store.loadReviews({ append: true });
  }
}
