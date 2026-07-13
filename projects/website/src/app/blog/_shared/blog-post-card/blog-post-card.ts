import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BLOG_COVER_PRESETS, withCloudinaryTransform, type BlogPost } from 'core';
import { BlogCategoryPipe } from '../../blog-category.pipe';

/**
 * Blog post card — the single card used by the article "Keep reading"
 * grid, and ready to replace the near-identical cards on the blog list
 * (follow-up). Cover art is Cloudinary-cropped to the 16:9 carousel
 * preset; the title/excerpt clamp to two lines.
 */
@Component({
  selector: 'mh-blog-post-card',
  imports: [RouterLink, DatePipe, BlogCategoryPipe],
  templateUrl: './blog-post-card.html',
  styleUrl: './blog-post-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogPostCard {
  readonly post = input.required<BlogPost>();
  /** `related` (article) omits the date footer; `grid` (list) shows it. */
  readonly variant = input<'related' | 'grid'>('related');

  readonly coverUrl = computed(() =>
    withCloudinaryTransform(this.post().coverImage, BLOG_COVER_PRESETS.homeCarousel),
  );
}
