import { DOCUMENT, Service, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

import {
  CARD_FONTS,
  CARD_HEIGHT,
  CARD_WIDTH,
  ShareCardContent,
  cardPalette,
  drawShareCard,
} from './share-card';

/** How a share ended: sent somewhere, or put away by the person. */
export type ShareOutcome = 'shared' | 'cancelled';

/**
 * Draws a workout's story card on the phone and hands it to the system
 * share sheet, which is where Instagram, Facebook, messages and "Save
 * image" already live. Nothing leaves the device until the person picks
 * where it goes, and no server ever sees the image.
 */
@Service()
export class ShareCardService {
  private readonly _document = inject(DOCUMENT);
  private _fontsReady: Promise<unknown> | null = null;

  /** The card as a PNG data URL, for the preview and for sharing. */
  async render(content: ShareCardContent, dark: boolean): Promise<string> {
    // The faces are bundled, but a face is only loaded once text asks for
    // it; a canvas would otherwise draw the first card in a fallback.
    this._fontsReady ??= Promise.all(CARD_FONTS.map((face) => this._document.fonts.load(face)));
    await this._fontsReady.catch(() => undefined);

    const canvas = this._document.createElement('canvas');
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');

    const styles = getComputedStyle(this._document.documentElement);
    drawShareCard(ctx, content, cardPalette(dark, (name) => styles.getPropertyValue(name).trim()));
    return canvas.toDataURL('image/png');
  }

  /**
   * Native: write to the app's cache (the folder Android lets other apps
   * read from) and open the share sheet. Web, in development: the browser's
   * own share where it can take files, a download where it cannot.
   */
  async share(dataUrl: string, title: string): Promise<ShareOutcome> {
    if (Capacitor.isNativePlatform()) {
      const { uri } = await Filesystem.writeFile({
        path: `motionhive-workout-${Date.now()}.png`,
        data: dataUrl.split(',')[1],
        directory: Directory.Cache,
      });
      try {
        await Share.share({ title, files: [uri], dialogTitle: title });
        return 'shared';
      } catch (err) {
        if (isCancel(err)) return 'cancelled';
        throw err;
      }
    }

    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], 'motionhive-workout.png', { type: 'image/png' });
    const nav = this._document.defaultView?.navigator;
    if (nav?.canShare?.({ files: [file] })) {
      try {
        await nav.share({ title, files: [file] });
        return 'shared';
      } catch (err) {
        if (isCancel(err)) return 'cancelled';
        throw err;
      }
    }
    const link = this._document.createElement('a');
    link.href = dataUrl;
    link.download = file.name;
    link.click();
    return 'shared';
  }
}

/** Closing the share sheet is a choice, not a failure. */
function isCancel(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '');
  return /cancel|abort/i.test(message) || (err instanceof DOMException && err.name === 'AbortError');
}
