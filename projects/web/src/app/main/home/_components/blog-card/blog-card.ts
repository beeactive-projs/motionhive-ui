import { Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { BLOG_COVER_PRESETS, BlogPost, withCloudinaryTransform } from 'core';

/**
 * Compact blog-post card for the home carousel. Shows the cover image,
 * category chip, title, excerpt, and author + read-time. Clicking the
 * card or "Read more" emits — the parent opens the full article on the
 * marketing site (motionhive.fit/blog/{slug}) in a new tab.
 */
@Component({
  selector: 'mh-blog-card',
  imports: [ButtonDirective, TranslatePipe],
  templateUrl: './blog-card.html',
  styleUrl: './blog-card.scss',
})
export class BlogCard {
  private readonly _translateService = inject(TranslateService);

  readonly post = input.required<BlogPost>();

  readonly readClick = output<BlogPost>();

  readonly readTimeLabel = computed(() => {
    const r = this.post().readTime ?? 0;
    return r > 0
      ? this._translateService.instant('home.journal.minRead', { minutes: r })
      : this._translateService.instant('home.blogCard.quickRead');
  });

  /** Cover URL piped through Cloudinary so a tall portrait upload
   *  comes back as a 16:9 cropped, ~800px-wide JPG/WebP — guarantees
   *  the carousel cell renders correctly regardless of source size. */
  readonly coverUrl = computed(() =>
    withCloudinaryTransform(this.post().coverImage, BLOG_COVER_PRESETS.homeCarousel),
  );

  onRead(): void {
    this.readClick.emit(this.post());
  }
}
