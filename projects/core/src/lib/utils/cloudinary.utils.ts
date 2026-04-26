/**
 * Cloudinary URL transformations.
 *
 * Writers upload images at any size or aspect ratio. Each FE render
 * context wants a different shape: a 16:9 carousel cell, a 21:9 hero
 * banner, a square list thumbnail. Rather than tell writers "your
 * cover MUST be 1200×675", we let Cloudinary crop and resize on the
 * fly via URL parameters.
 *
 * The helper inserts a transformation segment between `/upload/` and
 * the version/public-id portion of any Cloudinary URL. Non-Cloudinary
 * URLs pass through untouched, so FE code never has to branch.
 *
 * Common transforms:
 *   c_fill   — crop to fit the target aspect, preserving focal area
 *   ar_W:H   — target aspect ratio
 *   w_NNNN   — max width in px
 *   q_auto   — Cloudinary picks the best quality/size tradeoff
 *   f_auto   — Cloudinary picks the best format (AVIF/WebP/JPG)
 *   g_auto   — auto-pick the focal area for the crop
 */

export interface CloudinaryTransform {
  /** Target aspect ratio, e.g. "16:9", "21:9", "1:1". */
  aspectRatio?: string;
  /** Max width in pixels. */
  width?: number;
  /** Max height in pixels. */
  height?: number;
  /** Crop mode. Defaults to 'fill' which keeps the aspect and crops the rest. */
  crop?: 'fill' | 'fit' | 'limit' | 'pad' | 'thumb';
  /** Gravity (focal area) for the crop. Defaults to 'auto'. */
  gravity?: 'auto' | 'face' | 'center' | 'north' | 'south';
  /** Override quality. Defaults to 'auto'. */
  quality?: 'auto' | 'auto:best' | 'auto:good' | 'auto:eco' | number;
  /** Override format. Defaults to 'auto' (Cloudinary picks AVIF/WebP/JPG). */
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
}

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
  /** Editor preview while authoring — moderate size, square-ish OK. */
  editorPreview: {
    aspectRatio: '16:9',
    width: 720,
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto',
    format: 'auto',
  },
} as const satisfies Record<string, CloudinaryTransform>;

/**
 * Apply a Cloudinary transform to a URL.
 *
 * If the URL isn't a Cloudinary URL (no `/image/upload/` segment), or
 * is empty, it's returned unchanged. Pre-existing transforms in the
 * URL are preserved (we insert before them, so newer transforms win
 * by being applied last in the pipeline).
 */
export function withCloudinaryTransform(
  url: string | null | undefined,
  transform: CloudinaryTransform,
): string {
  if (!url) return '';
  const marker = '/image/upload/';
  const idx = url.indexOf(marker);
  if (idx === -1) return url;

  const segment = buildTransformSegment(transform);
  if (!segment) return url;

  return url.slice(0, idx + marker.length) + segment + '/' + url.slice(idx + marker.length);
}

function buildTransformSegment(t: CloudinaryTransform): string {
  const parts: string[] = [];

  parts.push(`c_${t.crop ?? 'fill'}`);
  if (t.aspectRatio) parts.push(`ar_${t.aspectRatio}`);
  parts.push(`g_${t.gravity ?? 'auto'}`);
  if (t.width) parts.push(`w_${t.width}`);
  if (t.height) parts.push(`h_${t.height}`);
  parts.push(`q_${t.quality ?? 'auto'}`);
  parts.push(`f_${t.format ?? 'auto'}`);

  return parts.join(',');
}
