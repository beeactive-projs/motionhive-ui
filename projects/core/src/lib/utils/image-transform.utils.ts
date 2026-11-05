/**
 * Image sizes by URL.
 *
 * People upload pictures at any size or aspect ratio. Each render context
 * wants a different shape: a 16:9 carousel cell, a 21:9 hero banner, a
 * small round avatar. Rather than store every size, the image host crops
 * and resizes on the fly from parameters in the URL.
 *
 * Pictures live in Cloudflare R2 behind `img.motionhive.fit` (and
 * `img-dev.motionhive.fit`), resized by Cloudflare's `/cdn-cgi/image/`
 * transformations. Links into the old Cloudinary account still get
 * Cloudinary's parameters until the move script has rewritten them. Any
 * other URL passes through untouched, so callers never branch.
 *
 * Each distinct size of each picture counts against Cloudflare's monthly
 * allowance, so widths are rounded up to a short ladder: a 72px and a
 * 76px avatar ask for the same 96px file.
 */

export interface ImageTransform {
  /** Target aspect ratio, e.g. "16:9", "21:9", "1:1". */
  aspectRatio?: string;
  /** Max width in pixels. */
  width?: number;
  /** Max height in pixels. */
  height?: number;
  /** Crop mode. Defaults to 'fill', which keeps the aspect and crops the rest. */
  crop?: 'fill' | 'fit' | 'limit' | 'pad' | 'thumb';
  /** Focal area for the crop. Defaults to 'auto'. */
  gravity?: 'auto' | 'face' | 'center' | 'north' | 'south';
  /** Quality. Defaults to 'auto'. */
  quality?: 'auto' | 'auto:best' | 'auto:good' | 'auto:eco' | number;
  /** Format. Defaults to 'auto' (the best the browser takes: AVIF, WebP, JPEG). */
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
}

/** The public picture hosts in front of our R2 buckets. */
const MEDIA_HOSTS = new Set(['img.motionhive.fit', 'img-dev.motionhive.fit']);

/** Widths a transformed picture may have; requests round up to the next. */
const WIDTH_LADDER = [64, 96, 128, 192, 256, 384, 480, 640, 800, 1200, 1600, 2048];

/**
 * Pre-baked transforms for the contexts where we render blog covers.
 * Add new ones here when a new render context is built so call-sites
 * stay terse and the magic numbers live in one file.
 */
export const BLOG_COVER_PRESETS = {
  /** Home carousel cell — small card on home, ~3 visible at desktop. */
  homeCarousel: {
    aspectRatio: '16:9',
    width: 800,
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto',
    format: 'auto',
  },
  /** Writer posts-list thumbnail — small card in admin list. */
  listThumb: {
    aspectRatio: '16:9',
    width: 480,
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto',
    format: 'auto',
  },
  /** Article hero on the marketing site — full-width banner. */
  articleHero: {
    aspectRatio: '21:9',
    width: 1600,
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto:good',
    format: 'auto',
  },
  /** Featured card on the blog index — left side of a 2-column card.
   *  Slightly less wide than articleHero, and gravity 'north' so a
   *  portrait subject's face + shoulders stay in frame instead of
   *  the crop zooming into the face. */
  featuredCard: {
    aspectRatio: '4:3',
    width: 1200,
    crop: 'fill',
    gravity: 'north',
    quality: 'auto:good',
    format: 'auto',
  },
  /** Editor preview while authoring — moderate size, square-ish OK. */
  editorPreview: {
    aspectRatio: '16:9',
    width: 720,
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto',
    format: 'auto',
  },
} as const satisfies Record<string, ImageTransform>;

/**
 * The URL of `url` at the size `transform` asks for. Empty for an empty
 * URL; unchanged for a URL no host of ours can resize.
 */
export function withImageTransform(
  url: string | null | undefined,
  transform: ImageTransform,
): string {
  if (!url) {
    return '';
  }
  const parsed = parseUrl(url);
  if (parsed && MEDIA_HOSTS.has(parsed.host)) {
    return cloudflareUrl(parsed, transform);
  }
  return cloudinaryUrl(url, transform);
}

// ─── Cloudflare (img.motionhive.fit) ──────────────────────────────────

function cloudflareUrl(url: URL, t: ImageTransform): string {
  // Already a transformed link: asking twice would nest the paths.
  if (url.pathname.startsWith('/cdn-cgi/')) {
    return url.toString();
  }
  const options = cloudflareOptions(t);
  if (!options) {
    return url.toString();
  }
  return `${url.origin}/cdn-cgi/image/${options}${url.pathname}`;
}

function cloudflareOptions(t: ImageTransform): string {
  const { width, height } = cloudflareSize(t);
  const parts: string[] = [];
  if (width) {
    parts.push(`width=${width}`);
  }
  if (height) {
    parts.push(`height=${height}`);
  }
  parts.push(`fit=${CLOUDFLARE_FIT[t.crop ?? 'fill']}`);
  const gravity = CLOUDFLARE_GRAVITY[t.gravity ?? 'auto'];
  if (gravity) {
    parts.push(`gravity=${gravity}`);
  }
  parts.push(`quality=${cloudflareQuality(t.quality ?? 'auto')}`);
  let format: string = t.format ?? 'auto';
  if (format === 'jpg') {
    format = 'jpeg';
  }
  parts.push(`format=${format}`);
  return parts.join(',');
}

/**
 * Width rounded up the ladder, and the height that keeps the asked shape
 * (from `height`, or from `aspectRatio`).
 */
function cloudflareSize(t: ImageTransform): { width?: number; height?: number } {
  const asked = t.width;
  if (!asked) {
    return { height: t.height };
  }
  let width = WIDTH_LADDER[WIDTH_LADDER.length - 1];
  for (const step of WIDTH_LADDER) {
    if (step >= asked) {
      width = step;
      break;
    }
  }
  let ratio = aspectHeightPerWidth(t.aspectRatio);
  if (t.height) {
    ratio = t.height / asked;
  }
  if (!ratio) {
    return { width };
  }
  return { width, height: Math.round(width * ratio) };
}

function aspectHeightPerWidth(aspect: string | undefined): number | null {
  if (!aspect) {
    return null;
  }
  const [w, h] = aspect.split(':').map(Number);
  if (!(w > 0) || !(h > 0)) {
    return null;
  }
  return h / w;
}

const CLOUDFLARE_FIT: Record<NonNullable<ImageTransform['crop']>, string> = {
  fill: 'cover',
  thumb: 'cover',
  fit: 'contain',
  limit: 'scale-down',
  pad: 'pad',
};

const CLOUDFLARE_GRAVITY: Record<NonNullable<ImageTransform['gravity']>, string | null> = {
  auto: 'auto',
  face: 'face',
  center: null,
  north: 'top',
  south: 'bottom',
};

function cloudflareQuality(q: NonNullable<ImageTransform['quality']>): number {
  if (typeof q === 'number') {
    return q;
  }
  return { auto: 80, 'auto:best': 90, 'auto:good': 85, 'auto:eco': 70 }[q];
}

// ─── Cloudinary (old links, until they are moved) ─────────────────────

/**
 * Inserts a transformation segment after `/image/upload/`. Pre-existing
 * transforms in the URL are kept (newer ones are applied last).
 */
function cloudinaryUrl(url: string, t: ImageTransform): string {
  const marker = '/image/upload/';
  const idx = url.indexOf(marker);
  if (idx === -1) {
    return url;
  }
  const parts: string[] = [];
  parts.push(`c_${t.crop ?? 'fill'}`);
  if (t.aspectRatio) {
    parts.push(`ar_${t.aspectRatio}`);
  }
  parts.push(`g_${t.gravity ?? 'auto'}`);
  if (t.width) {
    parts.push(`w_${t.width}`);
  }
  if (t.height) {
    parts.push(`h_${t.height}`);
  }
  parts.push(`q_${t.quality ?? 'auto'}`);
  parts.push(`f_${t.format ?? 'auto'}`);
  return url.slice(0, idx + marker.length) + parts.join(',') + '/' + url.slice(idx + marker.length);
}

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}
