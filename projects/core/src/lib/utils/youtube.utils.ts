/**
 * Tiny YouTube URL helpers — we deliberately do NOT call the YouTube
 * IFrame Player API or oEmbed at form-edit time (CORS + rate-limit
 * concerns; design assumed server-proxied resolution). For preview
 * purposes only, the `mqdefault.jpg` URL on `i.ytimg.com` is a
 * stable convention that YouTube guarantees for any public video id
 * — no API call required.
 *
 * If the URL doesn't parse to a video id, the helpers return null
 * and the caller falls back to "no preview yet" placeholder copy.
 */

// Matches:
//   https://www.youtube.com/watch?v=abc123XYZ_-
//   https://youtube.com/watch?v=abc123XYZ_-
//   https://youtu.be/abc123XYZ_-
//   https://www.youtube.com/embed/abc123XYZ_-
//   https://www.youtube.com/shorts/abc123XYZ_-
//   plus any trailing query / fragment
const YOUTUBE_ID_RE =
  /^https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#].*)?$/;

/**
 * Extract the 11-char video id from any common YouTube URL shape.
 * Returns null when the URL doesn't match — the caller should treat
 * null as "invalid URL" and show validation copy.
 */
export function youtubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = YOUTUBE_ID_RE.exec(url.trim());
  return match ? match[1] : null;
}

/**
 * Thumbnail URL for a given video id, at the "medium quality default"
 * size (320×180). Always available for any public video — no API call.
 *
 * Other sizes (use sparingly — the SD variants only exist for some
 * videos):
 *   - hqdefault.jpg  (480×360)  always present
 *   - sddefault.jpg  (640×480)  sometimes
 *   - maxresdefault.jpg (1280×720) only for HD uploads
 */
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

/**
 * Privacy-enhanced embed URL for inline playback via `<iframe>`.
 *
 * Uses `youtube-nocookie.com` (no tracking cookies until the user
 * actually plays) and disables the "related videos from other
 * channels" grid at the end (`rel=0`). `modestbranding=1` drops the
 * large YouTube logo in the control bar.
 *
 * The returned string is a plain URL — it MUST be run through
 * `DomSanitizer.bypassSecurityTrustResourceUrl` before binding to an
 * iframe `[src]` in Angular. That's safe here because `videoId` is
 * always the output of {@link youtubeVideoId} (an 11-char
 * `[A-Za-z0-9_-]` token), so no attacker-controlled markup can reach
 * the URL.
 *
 * Pass `autoplay=true` when the iframe is mounted in response to a
 * user gesture (the click-to-play facade) so playback starts without
 * a second tap.
 */
export function youtubeEmbedUrl(videoId: string, autoplay = false): string {
  const params = 'rel=0&modestbranding=1&playsinline=1' + (autoplay ? '&autoplay=1' : '');
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params}`;
}
