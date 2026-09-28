import { Component, computed, input, output } from '@angular/core';

import { translate } from 'core';

import { POST_MAX_IMAGES } from '../../groups.config';

/**
 * A post's photos, laid out by how many there are.
 *
 * One fills the width; two split it; three and four tile. The count drives
 * the grid through a `data-count` attribute rather than four template
 * branches — the shapes differ, the markup does not.
 *
 * The API caps a post at four images, so the "+N" overlay is defensive: it
 * covers older rows or a cap that moves, and costs one computed to keep.
 */
@Component({
  selector: 'mh-post-gallery',
  templateUrl: './post-gallery.html',
  styleUrl: './post-gallery.scss',
})
export class PostGallery {
  readonly urls = input.required<readonly string[]>();
  /** Names the post in each cell's label, so a screen reader hears whose. */
  readonly authorName = input('');

  /** The index tapped, for the viewer to open on. */
  readonly openPhoto = output<number>();

  readonly visible = computed(() => this.urls().slice(0, POST_MAX_IMAGES));

  readonly extra = computed(() => Math.max(0, this.urls().length - POST_MAX_IMAGES));

  label(index: number): string {
    const name = this.authorName();
    const params = { index: index + 1, total: this.visible().length, name };
    return translate(name ? 'groups.gallery.openPhotoBy' : 'groups.gallery.openPhoto', params);
  }

  open(index: number): void {
    this.openPhoto.emit(index);
  }
}
