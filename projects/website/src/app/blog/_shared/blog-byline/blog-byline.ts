import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Hex, authorBylineUrl, type BlogPost } from 'core';

/**
 * Author byline — one presentational component for every place a blog
 * author appears (article header, author bio card, and later the blog
 * list cards). The avatar is a brand hexagon (`mh-hex`), not a circle.
 *
 * Link behaviour follows the author model:
 * - Registered author with a handle → links to their public coach
 *   profile (`authorBylineUrl`).
 * - Editorial / guest byline (no handle) → renders as plain text
 *   (inline) or links back to the blog (card). No dead signup links.
 */
@Component({
  selector: 'mh-blog-byline',
  imports: [NgTemplateOutlet, RouterLink, Hex],
  templateUrl: './blog-byline.html',
  styleUrl: './blog-byline.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogByline {
  readonly post = input.required<BlogPost>();
  readonly variant = input<'inline' | 'card'>('inline');

  /** Optional role/title line for coach authors, e.g. "Strength coach". */
  readonly role = input<string | null>(null);
  /** Optional bio paragraph, shown in the `card` variant only. */
  readonly bio = input<string | null>(null);

  /** Public profile URL when the author is a registered coach, else null. */
  readonly profileUrl = computed(() => {
    const handle = this.post().authorHandle;
    return handle ? authorBylineUrl(handle) : null;
  });

  readonly handleAt = computed(() => {
    const handle = this.post().authorHandle;
    return handle ? `@${handle}` : '';
  });

  /** "Strength coach · @danlifts" — omits whichever part is missing. */
  readonly metaLine = computed(() => {
    const handle = this.post().authorHandle;
    return [this.role(), handle ? `@${handle}` : null].filter(Boolean).join(' · ');
  });

  /** Hex avatar size per variant. */
  readonly avatarSize = computed(() => (this.variant() === 'card' ? 64 : 46));
}
