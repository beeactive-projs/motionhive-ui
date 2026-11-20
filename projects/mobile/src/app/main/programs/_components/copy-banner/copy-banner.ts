import { Component, computed, input } from '@angular/core';

import { CopyClient, displayName } from 'core';

import { HexAvatar } from '../../../../_shared/components/hex-avatar/hex-avatar';
import { avatarToneFor } from '../../../../_shared/utils/avatar-tone.utils';

/**
 * The box over a client's copy of a plan (design ClientCopy): whose copy it
 * is, and that a change reaches only them while the program stays as it is.
 * On the copy's weeks and on each of its days, so the coach never mistakes
 * the copy for the program.
 */
@Component({
  selector: 'mh-copy-banner',
  imports: [HexAvatar],
  template: `
    <mh-hex-avatar
      size="md"
      aria-hidden="true"
      [name]="fullName()"
      [imageUrl]="avatarUrl()"
      [color]="tone()"
    />
    <div class="text">
      <span class="title">{{ title() }}</span>
      <span class="line">{{ line() }}</span>
    </div>
  `,
  styleUrl: './copy-banner.scss',
})
export class CopyBanner {
  readonly client = input<CopyClient | null>(null);
  /** "Anna's copy". */
  readonly title = input.required<string>();
  /** "Changes reach only Anna. Strength Base stays as it is." */
  readonly line = input.required<string>();

  readonly fullName = computed(() => displayName(this.client(), ''));

  readonly avatarUrl = computed(() => {
    const client = this.client();
    if (!client) {
      return null;
    }
    return client.avatarUrl;
  });

  readonly tone = computed(() => {
    const client = this.client();
    if (!client) {
      return avatarToneFor(null);
    }
    return avatarToneFor(client.id);
  });
}
