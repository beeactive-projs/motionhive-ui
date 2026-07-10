import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  computed,
  inject,
  input,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { HEX_ICONS, HexIconName } from './hex-icons';
import {
  DEFAULT_TONE,
  GRADIENT_FROM,
  GRADIENT_TO,
  HexOrientation,
  HexStatus,
  HexTone,
  TONES,
} from './hex.types';

/** Regular-hexagon width:height ratio (cos 30°). */
const RATIO = Math.cos(Math.PI / 6);

interface Pt {
  x: number;
  y: number;
}

/** Six vertices on a R=50 circle centred at (50,50). flat = vertex left/right. */
function hexVerts(orientation: HexOrientation): Pt[] {
  const base = orientation === 'flat' ? 0 : -90; // pointy → a vertex points up
  const pts: Pt[] = [];
  for (let i = 0; i < 6; i++) {
    const a = ((base + i * 60) * Math.PI) / 180;
    pts.push({ x: 50 + 50 * Math.cos(a), y: 50 + 50 * Math.sin(a) });
  }
  return pts;
}

/** Rounds every corner by the same radius from the true vertex (quadratic joins). */
function roundedPath(pts: Pt[], r: number): string {
  const n = pts.length;
  const a: Pt[] = [];
  const b: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p0 = pts[(i - 1 + n) % n];
    const p2 = pts[(i + 1) % n];
    const v1 = { x: p0.x - p1.x, y: p0.y - p1.y };
    const v2 = { x: p2.x - p1.x, y: p2.y - p1.y };
    const l1 = Math.hypot(v1.x, v1.y);
    const l2 = Math.hypot(v2.x, v2.y);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    a.push({ x: p1.x + (v1.x / l1) * rr, y: p1.y + (v1.y / l1) * rr });
    b.push({ x: p1.x + (v2.x / l2) * rr, y: p1.y + (v2.y / l2) * rr });
  }
  let d = `M ${a[0].x.toFixed(2)} ${a[0].y.toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    d += ` Q ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)} ${b[i].x.toFixed(2)} ${b[i].y.toFixed(2)}`;
    d += ` L ${a[(i + 1) % n].x.toFixed(2)} ${a[(i + 1) % n].y.toFixed(2)}`;
  }
  return `${d} Z`;
}

function viewBoxFor(pts: Pt[]): string {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return `${minX.toFixed(2)} ${minY.toFixed(2)} ${(Math.max(...xs) - minX).toFixed(2)} ${(
    Math.max(...ys) - minY
  ).toFixed(2)}`;
}

let seq = 0;

/**
 * MotionHive hexagon — one tintable primitive for avatars, icon tiles, badges,
 * step markers and brand accents.
 *
 * ```html
 * <mh-hex [size]="56" tone="navy" label="AM" />
 * <mh-hex [size]="48" tone="amber" icon="calendar" />
 * <mh-hex [size]="40" [img]="user.photo" ring="#fff" />
 * <mh-hex tone="ghost"><i class="pi pi-compass"></i></mh-hex>  <!-- projected glyph -->
 * ```
 */
@Component({
  selector: 'mh-hex',
  standalone: true,
  templateUrl: './hex.html',
  styleUrl: './hex.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mh-hex',
    '[style.width.px]': 'w()',
    '[style.height.px]': 'h()',
    '[style.font-size.px]': 'contentFontPx()',
    '[style.--hx-fg]': 'resolved().fg',
    '[style.--hx-bg]': 'bgVar()',
    '[style.--hx-ring]': 'resolved().ring || "transparent"',
    '[style.--hx-shadow]': 'shadow() ? "drop-shadow(0 3px 8px rgba(14,27,49,.10))" : "none"',
    '[attr.role]': 'ariaLabel() ? "img" : null',
    '[attr.aria-label]': 'ariaLabel()',
    '[attr.aria-hidden]': 'ariaLabel() ? null : "true"',
  },
})
export class Hex {
  /** Long-axis size in px (width when flat-top, height when pointy-top). */
  readonly size = input<number>(56);
  /** Named tone preset. Explicit bg/fg/ring/ringW override it. */
  readonly tone = input<HexTone | null>(null);
  /** `'flat'` = pointed left/right (design default), `'pointy'` = pointed up/down. */
  readonly orientation = input<HexOrientation>('flat');

  readonly bg = input<string | null>(null);
  readonly fg = input<string | null>(null);
  readonly ring = input<string | null>(null);
  readonly ringW = input<number | null>(null);
  /** Dashed ring (0 = solid). */
  readonly dash = input<number>(0);

  /** Initials / number / single glyph. */
  readonly label = input<string | null>(null);
  /** Label font-size override in px (auto-scales with size otherwise). */
  readonly fontSize = input<number | null>(null);
  /** Built-in icon name (see hex-icons.ts). */
  readonly icon = input<HexIconName | null>(null);
  /** Image URL — clipped to the hex. */
  readonly img = input<string | null>(null);

  /** Corner radius in the 100-unit viewBox (~22% of the edge by default). */
  readonly round = input<number>(11);
  /** Presence dot. */
  readonly status = input<HexStatus | null>(null);
  /** Soft drop shadow under the shape. */
  readonly shadow = input<boolean>(false);
  /** Subtle top highlight gradient over the body — adds depth to solid tones. */
  readonly sheen = input<boolean>(false);
  /** Accessible label; when set the host becomes `role="img"`, else `aria-hidden`. */
  readonly ariaLabel = input<string | null>(null);

  private readonly sanitizer = inject(DomSanitizer);

  // Icon markup is injected via [innerHTML] on an <svg>, which the server DOM
  // (domino) can't do — it throws NotYetImplemented and aborts the whole
  // prerender change-detection pass (blanking unrelated components). Icons are
  // decorative, so render them in the browser only. See hex.html.
  protected readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly uid = `mhhex${seq++}`;
  readonly clipId = `${this.uid}c`;
  readonly gradId = `${this.uid}g`;
  readonly sheenId = `${this.uid}s`;
  readonly clipUrl = `url(#${this.clipId})`;
  readonly gradFrom = GRADIENT_FROM;
  readonly gradTo = GRADIENT_TO;

  private readonly verts = computed(() => hexVerts(this.orientation()));
  readonly path = computed(() => roundedPath(this.verts(), this.round()));
  readonly viewBox = computed(() => viewBoxFor(this.verts()));

  readonly w = computed(() => (this.orientation() === 'flat' ? this.size() : this.size() * RATIO));
  readonly h = computed(() => (this.orientation() === 'flat' ? this.size() * RATIO : this.size()));

  readonly resolved = computed(() => {
    const base = (this.tone() && TONES[this.tone()!]) || DEFAULT_TONE;
    const bg = this.bg() ?? base.bg;
    const fg = this.fg() ?? base.fg;
    const ring = this.ring() ?? base.ring;
    const ringW = this.ringW() ?? base.ringW;
    return { bg, fg, ring, ringW, gradient: bg === '__grad' };
  });

  /** `--hx-bg` custom property (gradient/transparent draw via the path, not the var). */
  readonly bgVar = computed(() => (this.resolved().gradient ? 'transparent' : this.resolved().bg));
  /** Skip the body path for fully transparent (outline) tones. */
  readonly hideBg = computed(() => this.resolved().bg === 'transparent');
  readonly bgFill = computed(() => (this.resolved().gradient ? `url(#${this.gradId})` : 'var(--hx-bg)'));
  readonly hasRing = computed(() => {
    const r = this.resolved();
    return !!r.ring && r.ring !== 'transparent' && r.ringW > 0;
  });
  /** Sheen only makes sense over a visible (non-image, non-transparent) body. */
  readonly showSheen = computed(() => this.sheen() && !this.img() && !this.hideBg());

  readonly iconHtml = computed<SafeHtml | null>(() => {
    const name = this.icon();
    if (!name) return null;
    const markup = HEX_ICONS[name];
    return markup ? this.sanitizer.bypassSecurityTrustHtml(markup) : null;
  });

  readonly iconPx = computed(() => this.size() * 0.46);
  readonly labelPx = computed(
    () => this.fontSize() ?? this.size() * ((this.label()?.length ?? 0) > 2 ? 0.28 : 0.38),
  );
  /** Font-size for projected (ng-content) glyphs so PrimeNG icons scale with the hex. */
  readonly contentFontPx = computed(() => this.size() * 0.4);
}
