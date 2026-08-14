import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  signal,
  viewChild,
} from '@angular/core';

/**
 * Browser-chrome device demo — the framed muted-video mockup used in the
 * homepage "see it work" section and every feature-page hero.
 *
 * - Inline: a clean, continuous, muted autoplay loop (no controls).
 * - Enlargeable: an expand button opens a full-screen lightbox (dimmed
 *   backdrop, video centered) with NATIVE controls, so pause / replay / scrub
 *   live only in the enlarged view, not cluttering the inline preview.
 *
 * Shows a poster placeholder with a play affordance until a `src` is provided.
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
          <video #vid [src]="s" [poster]="poster() || ''" autoplay muted loop playsinline
            preload="metadata"></video>
          @if (enlargeable()) {
            <button type="button" class="expand" (click)="open()" aria-label="Enlarge video">
              <i class="pi pi-window-maximize" aria-hidden="true"></i>
            </button>
          }
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

    @if (expanded()) {
      <div class="lightbox" (click)="close()" role="dialog" aria-modal="true" aria-label="Video preview">
        <button #closeBtn type="button" class="lightbox__close" (click)="close()" aria-label="Close">
          <i class="pi pi-times" aria-hidden="true"></i>
        </button>
        <div class="lightbox__stage" (click)="$event.stopPropagation()">
          <video [src]="src()!" [poster]="poster() || ''" autoplay muted loop playsinline controls
            controlslist="nodownload noplaybackrate noremoteplayback" disablepictureinpicture></video>
        </div>
      </div>
    }
  `,
  styleUrl: './media-demo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEsc()',
  },
})
export class MediaDemo {
  readonly url = input('app.motionhive.fit');
  readonly src = input<string | null>(null);
  readonly poster = input<string | null>(null);
  readonly caption = input('');
  /** Show the expand affordance + allow the full-screen lightbox. */
  readonly enlargeable = input(true, { transform: booleanAttribute });

  /** Lightbox open state. Renders nothing until opened (browser-only). */
  readonly expanded = signal(false);

  private readonly _video = viewChild<ElementRef<HTMLVideoElement>>('vid');
  private readonly _closeBtn = viewChild<ElementRef<HTMLButtonElement>>('closeBtn');

  constructor() {
    // Autoplay is unreliable across hydration. Two things bite on the very
    // first (prerendered) load that don't on client-side navigation:
    //   1. The `muted` ATTRIBUTE survives hydration but the `muted` PROPERTY
    //      isn't reliably set — and the browser's autoplay policy checks the
    //      property, so play() gets blocked (NotAllowedError) and the clip
    //      just sits on its poster. Set el.muted = true explicitly.
    //   2. A one-shot afterNextRender can fire before the <video> (inside the
    //      @if) is queried. An effect on the viewChild signal kicks playback
    //      whenever the element resolves — first load AND navigation — and we
    //      retry on `canplay` for slow buffers.
    // Runs browser-only: `_video()` is null during SSR.
    effect((onCleanup) => {
      const el = this._video()?.nativeElement;
      if (!el) return;
      el.muted = true;
      const play = (): void => void el.play().catch(() => undefined);
      play();
      el.addEventListener('canplay', play);
      onCleanup(() => el.removeEventListener('canplay', play));
    });
  }

  open(): void {
    this.expanded.set(true);
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
      // Move focus into the dialog for keyboard users.
      queueMicrotask(() => this._closeBtn()?.nativeElement.focus());
    }
  }

  close(): void {
    this.expanded.set(false);
    if (typeof document !== 'undefined') document.body.style.overflow = '';
  }

  onEsc(): void {
    if (this.expanded()) this.close();
  }
}
