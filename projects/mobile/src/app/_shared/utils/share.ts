/**
 * Handing a link to the outside world, from inside a WebView.
 *
 * Two things make this more than a one-liner. `navigator.share` is frequently
 * missing from the Android System WebView, so it can never be assumed — every
 * path has to be able to fall back to the clipboard. And when it is present, a
 * user dismissing the share tray rejects with an `AbortError`, which is a
 * completed interaction, not a failure: toasting an error there tells someone
 * their deliberate "no" went wrong.
 *
 * Callers get an outcome rather than a boolean so they can say the right thing:
 * a native share needs no toast (the OS already gave feedback), a clipboard
 * fallback does.
 */

export const ShareOutcomes = {
  /** Handed to the OS share tray. It has already given the user feedback. */
  Shared: 'shared',
  /** No share tray available — the text went to the clipboard instead. */
  Copied: 'copied',
  /** The user dismissed the share tray. Say nothing. */
  Cancelled: 'cancelled',
  /** Neither route worked. Worth a toast. */
  Failed: 'failed',
} as const;

export type ShareOutcome = (typeof ShareOutcomes)[keyof typeof ShareOutcomes];

export interface SharePayload {
  /** Shown as the share sheet's heading on platforms that use one. */
  title?: string;
  /** The human sentence. Also what gets copied, above the URL, on fallback. */
  text?: string;
  url: string;
}

/** Write to the clipboard. False when the API is missing or blocked. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Share via the OS if it will have us, else copy.
 *
 * The clipboard fallback copies `text` and `url` on separate lines when both
 * are set — pasting a bare URL loses the sentence that gave it meaning, which
 * for a session link is the half that says what and when.
 */
export async function shareOrCopy(payload: SharePayload): Promise<ShareOutcome> {
  const { title, text, url } = payload;

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return ShareOutcomes.Shared;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return ShareOutcomes.Cancelled;
      }
      // Anything else — no share target, a permissions policy block — is worth
      // trying the clipboard for rather than surfacing as a dead end.
    }
  }

  const copied = await copyToClipboard(text ? `${text}\n${url}` : url);
  return copied ? ShareOutcomes.Copied : ShareOutcomes.Failed;
}
