import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import {
  youtubeEmbedUrl,
  youtubeThumbnailUrl,
  youtubeVideoId,
} from '../../utils/youtube.utils';

/**
 * `mh-youtube-embed` — inline YouTube player using the click-to-play
 * "facade" pattern.
 *
 * Why a facade and not a plain `<iframe>`: a live YouTube iframe pulls
 * ~1MB+ of player JS and sets cookies the moment it mounts. Rendering
 * only a thumbnail + play button until the user clicks keeps catalog /
 * detail surfaces fast and avoids the privacy hit — the same trick
 * `lite-youtube` uses. The real iframe (privacy-enhanced
 * `youtube-nocookie.com`, autoplay-on-mount) appears only after the
 * click.
 *
 * Robustness: if `url` doesn't parse to a video id, the component
 * degrades to a plain "Watch on YouTube" link rather than rendering a
 * broken player.
 *
 * Reusability: zero domain knowledge. Drop it anywhere an exercise (or
 * anything else) exposes a YouTube URL:
 *   <mh-youtube-embed [url]="exercise.youtubeUrl" [title]="exercise.name" />
 */
@Component({
  selector: 'mh-youtube-embed',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let vid = videoId();
    @if (vid) {
    <div class="mh-yt">
      @if (playing()) {
      <iframe
        class="mh-yt__frame"
        [src]="safeEmbedUrl()"
        [title]="title() || 'YouTube video player'"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen
      ></iframe>
      } @else {
      <button
        type="button"
        class="mh-yt__facade"
        (click)="play()"
        [attr.aria-label]="'Play video' + (title() ? ': ' + title() : '')"
      >
        <img class="mh-yt__thumb" [src]="thumb()" [alt]="title() || ''" loading="lazy" />
        <span class="mh-yt__scrim"></span>
        <span class="mh-yt__play" aria-hidden="true">
          <svg viewBox="0 0 68 48" width="68" height="48">
            <path
              class="mh-yt__play-bg"
              d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55c-2.93.78-4.63 3.26-5.42 6.19C.06 13.05 0 24 0 24s.06 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.94 34.95 68 24 68 24s-.06-10.95-1.48-16.26z"
            />
            <path class="mh-yt__play-arrow" d="M45 24 27 14v20z" />
          </svg>
        </span>
      </button>
      }
    </div>
    } @else if (url()) {
    <a class="mh-yt__fallback" [href]="url()" target="_blank" rel="noopener noreferrer">
      <i class="pi pi-youtube"></i> Watch on YouTube
    </a>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .mh-yt {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      overflow: hidden;
      border-radius: 0.5rem;
      background: #000;
    }
    .mh-yt__frame {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border: 0;
    }
    .mh-yt__facade {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      padding: 0;
      border: 0;
      cursor: pointer;
      background: #000;
      appearance: none;
    }
    .mh-yt__thumb {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .mh-yt__scrim {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.35));
      transition: background 0.2s ease;
    }
    .mh-yt__facade:hover .mh-yt__scrim {
      background: rgba(0, 0, 0, 0.15);
    }
    .mh-yt__play {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: inline-flex;
      filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.35));
    }
    .mh-yt__play-bg {
      fill: #212121;
      opacity: 0.85;
      transition: opacity 0.2s ease, fill 0.2s ease;
    }
    .mh-yt__facade:hover .mh-yt__play-bg {
      fill: #ff0000;
      opacity: 1;
    }
    .mh-yt__play-arrow {
      fill: #fff;
    }
    .mh-yt__facade:focus-visible {
      outline: 3px solid var(--p-primary-color, #6366f1);
      outline-offset: -3px;
    }
    .mh-yt__fallback {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--p-primary-color, #6366f1);
      text-decoration: none;
    }
    .mh-yt__fallback:hover {
      text-decoration: underline;
    }
    .mh-yt__fallback .pi-youtube {
      color: #ff0000;
    }
  `,
})
export class YoutubeEmbed {
  /** Raw YouTube URL (watch / youtu.be / embed / shorts). */
  readonly url = input<string | null>(null);
  /** Accessible label + iframe/thumbnail title. */
  readonly title = input<string>('');
  /** Optional thumbnail override (else derived from the video id). */
  readonly thumbnailUrl = input<string | null>(null);

  private readonly _sanitizer = inject(DomSanitizer);

  readonly playing = signal(false);

  readonly videoId = computed(() => youtubeVideoId(this.url()));

  readonly thumb = computed(() => {
    const vid = this.videoId();
    return this.thumbnailUrl() ?? (vid ? youtubeThumbnailUrl(vid) : '');
  });

  /**
   * Sanitized embed URL, built only once the user clicks play (so the
   * autoplay iframe mounts in response to the gesture). Safe because
   * `videoId` is a strictly-validated 11-char token.
   */
  readonly safeEmbedUrl = computed<SafeResourceUrl | null>(() => {
    const vid = this.videoId();
    if (!vid || !this.playing()) return null;
    return this._sanitizer.bypassSecurityTrustResourceUrl(youtubeEmbedUrl(vid, true));
  });

  play(): void {
    this.playing.set(true);
  }
}
