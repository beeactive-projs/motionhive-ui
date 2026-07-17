import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Browser-chrome device demo — the framed muted-video mockup used in the
 * homepage "see it work" section and every feature-page hero. Shows a poster
 * placeholder with a play affordance until a `src` clip is provided.
 */
@Component({
  selector: 'mh-media-demo',
  template: `
    <div class="device">
      <div class="bar" aria-hidden="true">
        <i></i><i></i><i></i>
        <span class="u">{{ url() }}</span>
      </div>
      <div class="screen">
        @if (src(); as s) {
          <video [src]="s" [poster]="poster() || ''" autoplay muted loop playsinline preload="none"></video>
        } @else {
          <div class="ph">
            <span class="play"><i class="pi pi-play" aria-hidden="true"></i></span>
          </div>
        }
        @if (caption()) {
          <span class="cap">{{ caption() }}</span>
        }
      </div>
    </div>
  `,
  styleUrl: './media-demo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaDemo {
  readonly url = input('app.motionhive.fit');
  readonly src = input<string | null>(null);
  readonly poster = input<string | null>(null);
  readonly caption = input('');
}
