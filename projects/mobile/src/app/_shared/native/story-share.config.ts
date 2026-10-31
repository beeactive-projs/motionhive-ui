/**
 * Pure helpers for the `StoryShare` native plugin (`story-share.ts`),
 * tested in `story-share.config.spec.ts`.
 */

/** Error codes the native side rejects with, read from the error's `code`. */
export const StoryShareErrors = {
  /** Instagram (or an image clipboard) is not there on this phone. */
  Unavailable: 'UNAVAILABLE',
  /** The person did not allow adding to Photos. */
  Denied: 'DENIED',
} as const;

/** The error's code, when the native side gave one. */
export function storyShareErrorCode(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
}

/** `data:image/png;base64,AAAA` → `AAAA`; a bare base64 string passes through. */
export function base64Of(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return dataUrl.startsWith('data:') && comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}
