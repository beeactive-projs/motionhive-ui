import { Directive, HostAttributeToken, computed, inject, input } from '@angular/core';

import { PhotoViewerService } from '../services/photo-viewer.service';

/**
 * Makes a shown photo open full screen: `[mhViewPhoto]="url"` on the photo
 * (an avatar, a group's photo, a workout's cover), with what it shows in
 * `mhViewPhotoAlt` and the tap's name in `mhViewPhotoLabel`.
 *
 * The host itself takes the tap rather than a button around it, so no
 * layout changes: it becomes a button (role, focus, Enter and Space) only
 * while there is a photo to open, and stays a plain picture otherwise (an
 * initials tile, a photo still loading). A picture marked `aria-hidden`
 * beside its own name stays hidden then, and is shown as the button while
 * it has a photo.
 */
@Directive({
  selector: '[mhViewPhoto]',
  host: {
    '[attr.role]': 'role()',
    '[attr.tabindex]': 'tabIndex()',
    '[attr.aria-label]': 'ariaLabel()',
    '[attr.aria-hidden]': 'ariaHidden()',
    '[class.mh-photo-tap]': 'hasPhoto()',
    '(click)': 'open($event)',
    '(keydown.enter)': 'open($event)',
    '(keydown.space)': 'open($event)',
  },
})
export class ViewPhotoDirective {
  private readonly _viewer = inject(PhotoViewerService);
  /** The host's own `aria-hidden`, kept while there is no photo to open. */
  private readonly _hidden = inject(new HostAttributeToken('aria-hidden'), { optional: true });

  readonly url = input<string | null | undefined>(null, { alias: 'mhViewPhoto' });
  readonly alt = input('', { alias: 'mhViewPhotoAlt' });
  readonly label = input('', { alias: 'mhViewPhotoLabel' });

  readonly hasPhoto = computed(() => !!this.url());

  readonly role = computed(() => {
    if (this.hasPhoto()) {
      return 'button';
    }
    return null;
  });

  readonly tabIndex = computed(() => {
    if (this.hasPhoto()) {
      return 0;
    }
    return null;
  });

  readonly ariaLabel = computed(() => {
    if (this.hasPhoto() && this.label()) {
      return this.label();
    }
    return null;
  });

  readonly ariaHidden = computed(() => {
    if (this.hasPhoto()) {
      return null;
    }
    return this._hidden;
  });

  open(event: Event): void {
    const url = this.url();
    if (!url) {
      return;
    }
    // A button inside the photo (Change photo on a workout's cover) keeps its own tap.
    if (event.defaultPrevented) {
      return;
    }
    event.preventDefault();
    this._viewer.open([{ url, alt: this.alt() }]);
  }
}
