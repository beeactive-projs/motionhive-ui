import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { BlogPost } from 'core';

/**
 * Compact blog-post card for the home carousel. Shows the cover image,
 * category chip, title, excerpt, and author + read-time. Clicking the
 * card or "Read more" emits — the parent opens the full article on the
 * marketing site (motionhive.fit/blog/{slug}) in a new tab.
 */
@Component({
  selector: 'mh-blog-card',
  imports: [ButtonModule],
  templateUrl: './blog-card.html',
  styleUrl: './blog-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogCard {
  readonly post = input.required<BlogPost>();

  readonly readClick = output<BlogPost>();

  readonly readTimeLabel = computed(() => {
    const r = this.post().readTime ?? 0;
    return r > 0 ? `${r} min read` : 'Quick read';
  });

  onRead(): void {
    this.readClick.emit(this.post());
  }
}
