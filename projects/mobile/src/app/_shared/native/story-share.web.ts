import { WebPlugin } from '@capacitor/core';

import { StoryShareOptions, StorySharePlugin } from './story-share';

/** Where "Open Instagram" goes when there is no app to open. */
const INSTAGRAM_WEB = 'https://www.instagram.com/';

/**
 * The browser build (development, and the QA runs). Instagram's Stories
 * API exists only between two apps, so it is never available here and the
 * caller falls back to the share sheet. Saving downloads the image, and
 * copying uses the async clipboard where the browser lets it.
 */
export class StoryShareWeb extends WebPlugin implements StorySharePlugin {
  async isInstagramAvailable(): Promise<{ available: boolean }> {
    return { available: false };
  }

  async shareToStory(_options: StoryShareOptions): Promise<void> {
    throw this.unavailable('Instagram Stories need the Instagram app.');
  }

  async saveToPhotos(options: { image: string }): Promise<void> {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${options.image}`;
    link.download = 'motionhive-workout.png';
    link.click();
  }

  async copyImage(options: { image: string }): Promise<void> {
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
      throw this.unavailable('This browser cannot put an image on the clipboard.');
    }
    const blob = await (await fetch(`data:image/png;base64,${options.image}`)).blob();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  }

  async openInstagram(): Promise<{ opened: boolean }> {
    window.open(INSTAGRAM_WEB, '_blank', 'noopener');
    return { opened: true };
  }
}
