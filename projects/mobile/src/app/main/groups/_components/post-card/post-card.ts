import { Component, computed, inject, input, output } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { Post, displayName, formatRelativeShort } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';
import { PostGallery } from '../post-gallery/post-gallery';
import { PostWorkoutCard } from '../post-workout/post-workout';

/**
 * One post as a card: the author with the group and time under the name, a
 * ⋯ for the post's verbs, the text, the workout card, the photos, then Like
 * and Comment. The Groups feed and a group's Posts tab draw the same card.
 *
 * The card is not one tap target: the text opens the post, a photo opens the
 * viewer, and the buttons do their own thing.
 */
@Component({
  selector: 'mh-post-card',
  imports: [HexAvatar, IonButton, IonIcon, PostGallery, PostWorkoutCard, TranslatePipe],
  templateUrl: './post-card.html',
  styleUrl: './post-card.scss',
})
export class PostCard {
  private readonly _translateService = inject(TranslateService);

  readonly post = input.required<Post>();
  /** The group's name before the time, on the feed that mixes groups. */
  readonly groupName = input<string | null>(null);
  /** Whether the ⋯ shows: off when the reader has no verb on this post. */
  readonly showMore = input(true);

  readonly open = output<void>();
  readonly openPhoto = output<number>();
  readonly like = output<void>();
  readonly comment = output<void>();
  readonly more = output<void>();

  readonly authorName = computed(() =>
    displayName(this.post().author, this._translateService.instant('groups.common.member')),
  );

  readonly avatarUrl = computed(() => {
    const author = this.post().author;
    if (!author) {
      return null;
    }
    return author.avatarUrl;
  });

  readonly tone = computed(() => avatarToneFor(this.post().authorId));

  /** "Morning Crew · 2h" on the feed, "2h" inside the group. */
  readonly meta = computed(() => {
    const time = formatRelativeShort(this.post().postedAt);
    const group = this.groupName();
    if (group) {
      return `${group} · ${time}`;
    }
    return time;
  });

  readonly liked = computed(() => !!this.post().myReaction);

  readonly handle = computed(() => {
    const author = this.post().author;
    if (!author) {
      return null;
    }
    return author.handle ?? null;
  });
}
