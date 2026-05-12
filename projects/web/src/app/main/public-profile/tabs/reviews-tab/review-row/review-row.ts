import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Card } from 'primeng/card';
import { Avatar } from '../../../../../_shared/components/avatar/avatar';
import type { AvatarUser, Review } from 'core';

@Component({
  selector: 'mh-review-row',
  imports: [DatePipe, Card, Avatar],
  templateUrl: './review-row.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewRow {
  readonly review = input.required<Review>();

  readonly avatarUser = computed<AvatarUser>(() => {
    const r = this.review();
    const [first, ...rest] = r.author.name.split(' ');
    return {
      firstName: first ?? '',
      lastName: rest.join(' '),
      avatarUrl: r.author.avatarUrl,
    };
  });

  readonly stars = computed(() => Array.from({ length: 5 }, (_, i) => i + 1));
}
