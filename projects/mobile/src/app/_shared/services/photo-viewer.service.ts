import { Service, computed, signal } from '@angular/core';

/** One photo to show full screen: a ready address (public, or an object URL) and what it shows. */
export interface ViewerPhoto {
  url: string;
  alt: string;
}

/**
 * The full-screen photo viewer, opened from anywhere (`mhViewPhoto`, or
 * `open` with several photos) and drawn once by `mh-photo-viewer` in the tab
 * shell. A profile photo, a group's photo, a workout's photo: whatever is
 * shown small or cropped can be seen whole.
 *
 * The photos come ready to show: a private workout photo is loaded by the
 * screen that shows it (an object URL), so the viewer never fetches.
 */
@Service()
export class PhotoViewerService {
  private readonly _photos = signal<readonly ViewerPhoto[]>([]);
  private readonly _index = signal(0);

  readonly photos = this._photos.asReadonly();
  readonly index = this._index.asReadonly();
  readonly isOpen = computed(() => this._photos().length > 0);
  readonly current = computed<ViewerPhoto | null>(() => {
    const photo = this._photos()[this._index()];
    if (!photo) {
      return null;
    }
    return photo;
  });
  readonly total = computed(() => this._photos().length);
  readonly hasPrevious = computed(() => this._index() > 0);
  readonly hasNext = computed(() => this._index() < this._photos().length - 1);

  /** Shows `photos` from the one at `index`; photos with no address are left out. */
  open(photos: readonly ViewerPhoto[], index = 0): void {
    const shown = photos.filter((photo) => !!photo.url);
    if (shown.length === 0) {
      return;
    }
    this._photos.set(shown);
    this._index.set(Math.min(Math.max(index, 0), shown.length - 1));
  }

  next(): void {
    if (this.hasNext()) {
      this._index.update((index) => index + 1);
    }
  }

  previous(): void {
    if (this.hasPrevious()) {
      this._index.update((index) => index - 1);
    }
  }

  close(): void {
    this._photos.set([]);
    this._index.set(0);
  }
}
