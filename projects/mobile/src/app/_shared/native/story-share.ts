import { registerPlugin } from '@capacitor/core';

/**
 * The app's own native plugin for getting a picture off the phone: an
 * Instagram Story through Instagram's Stories API, Photos, and the
 * clipboard as an image. No published plugin does the first, and the
 * share sheet cannot: it hands Instagram a file, not a sticker over a
 * background.
 *
 * Native code: `ios/App/App/StorySharePlugin.swift` (registered in
 * `MainViewController.swift`) and
 * `android/app/src/main/java/fit/motionhive/app/StorySharePlugin.java`
 * (registered in `MainActivity`). The browser build gets
 * `story-share.web.ts`, where Instagram is never there.
 *
 * Images cross the bridge as base64 without the `data:` prefix: PNG for
 * anything with transparency, JPEG for a photo background.
 */
export interface StorySharePlugin {
  /** Whether Instagram is installed and takes a Story from another app. */
  isInstagramAvailable(): Promise<{ available: boolean }>;
  /**
   * Opens Instagram's Story editor with the sticker on top of either the
   * background image or the two colours. Rejects with `UNAVAILABLE` when
   * Instagram is not installed.
   */
  shareToStory(options: StoryShareOptions): Promise<void>;
  /** Adds the image to the photo library. Rejects with `DENIED` when not allowed. */
  saveToPhotos(options: { image: string }): Promise<void>;
  /** Puts the image (transparency kept) on the clipboard. iOS and web only. */
  copyImage(options: { image: string }): Promise<void>;
  /** Opens Instagram itself; `opened` false when it is not installed. */
  openInstagram(): Promise<{ opened: boolean }>;
}

export interface StoryShareOptions {
  /** The Facebook App ID Instagram asks for as `source_application`. */
  sourceApplication: string;
  stickerImage: string;
  backgroundImage?: string;
  /** `#rrggbb`, used only without a background image. */
  backgroundTopColor?: string;
  backgroundBottomColor?: string;
}

export const StoryShare = registerPlugin<StorySharePlugin>('StoryShare', {
  web: () => import('./story-share.web').then((module) => new module.StoryShareWeb()),
});
