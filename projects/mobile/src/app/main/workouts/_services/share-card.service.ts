import { DOCUMENT, Service, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

import { environment } from 'core';

import { StoryShare } from '../../../_shared/native/story-share';
import {
  StoryShareErrors,
  base64Of,
  storyShareErrorCode,
} from '../../../_shared/native/story-share.config';
import { HexShape } from '../../../_shared/config/hexagon.config';
import { CardTheme, ShareCardContent, StickerStyle, StickerStyles } from './share-card.config';
import {
  CardPalette,
  canvasMeasure,
  cardPalette,
  drawQuickStory,
  drawStoryBackground,
  fontString,
  paintLayout,
} from './share-card';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  Measure,
  SHARE_FONTS,
  ShareLayout,
  badgeLayout,
  cellsLayout,
  fullLayout,
} from './share-layout.config';

/**
 * How a hand-off ended: sent somewhere, put away by the person, or (the
 * browser build without Web Share) downloaded, which needs saying.
 */
export type ShareOutcome = 'shared' | 'cancelled' | 'downloaded';

/** How Open in Instagram ended: the Story editor opened, or Instagram is not there. */
export type StoryOutcome = 'opened' | 'unavailable';

/** How Save to Photos ended. */
export type SaveOutcome = 'saved' | 'denied';

/** Everything Instagram's Stories API takes: a sticker over a photo or two colours. */
export interface StoryParts {
  /** PNG data URL, transparent around the sticker. */
  sticker: string;
  /** JPEG data URL of the photo at Story size, or null for the colours. */
  background: string | null;
  top: string;
  bottom: string;
}

/**
 * Draws a workout's share images on the phone and hands them on: to an
 * Instagram Story, to Photos, to the clipboard or to the system share
 * sheet. Nothing leaves the device until the person picks where it goes,
 * and no server ever sees the image.
 */
@Service()
export class ShareCardService {
  private readonly _document = inject(DOCUMENT);
  private _fontsReady: Promise<unknown> | null = null;

  /** The theme's paint, read from the app's colour ramps. */
  palette(theme: CardTheme): CardPalette {
    const styles = getComputedStyle(this._document.documentElement);
    return cardPalette(theme, (name) => styles.getPropertyValue(name).trim());
  }

  /**
   * The Quick sticker, transparent around it, in the person's hexagon.
   * `scale` below 1 for a preview: the same layout, drawn smaller.
   */
  async sticker(
    content: ShareCardContent,
    theme: CardTheme,
    style: StickerStyle,
    shape: HexShape,
    scale = 1,
  ): Promise<HTMLCanvasElement> {
    return this._draw(theme, shape, scale, null, (measure) =>
      style === StickerStyles.Cells
        ? cellsLayout(content, measure, shape)
        : badgeLayout(content, measure, shape),
    );
  }

  /** The Full way's sticker with the logo and the link, as a PNG data URL. */
  async brandedSticker(
    content: ShareCardContent,
    theme: CardTheme,
    shape: HexShape,
  ): Promise<string> {
    const canvas = await this._draw(theme, shape, 1, null, (measure) =>
      badgeLayout(content, measure, shape, true),
    );
    return canvas.toDataURL('image/png');
  }

  /** The Quick Story as it will look: a PNG, or a JPEG over a photo. */
  async quickStory(
    content: ShareCardContent,
    theme: CardTheme,
    style: StickerStyle,
    shape: HexShape,
    photo: CanvasImageSource | null,
    scale = 1,
  ): Promise<string> {
    const sticker = await this.sticker(content, theme, style, shape, scale);
    const { canvas, ctx } = await this._canvas(CARD_WIDTH, CARD_HEIGHT, scale);
    drawQuickStory(ctx, sticker, this.palette(theme), photo);
    return canvas.toDataURL(photo ? 'image/jpeg' : 'image/png', 0.92);
  }

  /**
   * The Full card as a data URL: a PNG, or a JPEG when it carries a photo
   * (the photo fills the card edge to edge, and a lossless photo is several
   * MB to hand across the bridge twice).
   */
  async fullCard(
    content: ShareCardContent,
    theme: CardTheme,
    shape: HexShape,
    photo: CanvasImageSource | null,
    scale = 1,
  ): Promise<string> {
    const canvas = await this._draw(theme, shape, scale, photo, (measure) =>
      fullLayout(content, measure, shape, !!photo),
    );
    return canvas.toDataURL(photo ? 'image/jpeg' : 'image/png', 0.92);
  }

  /** The pieces Instagram's Stories API takes, at full size. */
  async storyParts(
    content: ShareCardContent,
    theme: CardTheme,
    style: StickerStyle,
    shape: HexShape,
    photo: CanvasImageSource | null,
  ): Promise<StoryParts> {
    const palette = this.palette(theme);
    const sticker = (await this.sticker(content, theme, style, shape)).toDataURL('image/png');
    let background: string | null = null;
    if (photo) {
      const { canvas, ctx } = await this._canvas(CARD_WIDTH, CARD_HEIGHT, 1);
      drawStoryBackground(ctx, palette, photo);
      background = canvas.toDataURL('image/jpeg', 0.9);
    }
    return { sticker, background, top: palette.storyTop, bottom: palette.storyBottom };
  }

  /** Whether Instagram can take a Story from this app (never in the browser). */
  async instagramAvailable(): Promise<boolean> {
    try {
      return (await StoryShare.isInstagramAvailable()).available;
    } catch {
      return false;
    }
  }

  /** Opens Instagram's Story editor with the sticker on the photo or the colours. */
  async toInstagramStory(parts: StoryParts): Promise<StoryOutcome> {
    if (!(await this.instagramAvailable())) return 'unavailable';
    try {
      await StoryShare.shareToStory({
        sourceApplication: environment.facebookAppId,
        stickerImage: base64Of(parts.sticker),
        ...(parts.background
          ? { backgroundImage: base64Of(parts.background) }
          : { backgroundTopColor: parts.top, backgroundBottomColor: parts.bottom }),
      });
      return 'opened';
    } catch (err) {
      if (storyShareErrorCode(err) === StoryShareErrors.Unavailable) return 'unavailable';
      throw err;
    }
  }

  /** Adds the card to Photos (a download in the browser). */
  async saveToPhotos(dataUrl: string): Promise<SaveOutcome> {
    try {
      await StoryShare.saveToPhotos({ image: base64Of(dataUrl) });
      return 'saved';
    } catch (err) {
      if (storyShareErrorCode(err) === StoryShareErrors.Denied) return 'denied';
      throw err;
    }
  }

  /** Puts the image on the clipboard, transparency kept. */
  async copyImage(dataUrl: string): Promise<void> {
    await StoryShare.copyImage({ image: base64Of(dataUrl) });
  }

  /** Opens Instagram; the website when the app is not there. */
  async openInstagram(): Promise<void> {
    const { opened } = await StoryShare.openInstagram();
    if (!opened) {
      this._document.defaultView?.open('https://www.instagram.com/', '_blank', 'noopener');
    }
  }

  /**
   * The system share sheet. Native: written to the app's cache (the folder
   * Android lets other apps read from) under one name, so shares do not
   * pile up there. Web, in development: the browser's own share where it
   * can take files, a download where it cannot (and the caller says so).
   */
  async share(dataUrl: string, title: string): Promise<ShareOutcome> {
    if (Capacitor.isNativePlatform()) {
      const { uri } = await Filesystem.writeFile({
        path: dataUrl.startsWith('data:image/jpeg') ? SHARE_FILE_JPEG : SHARE_FILE_PNG,
        data: base64Of(dataUrl),
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
    const file = new File([blob], blob.type === 'image/jpeg' ? SHARE_FILE_JPEG : SHARE_FILE_PNG, {
      type: blob.type,
    });
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
    return 'downloaded';
  }

  /**
   * Lays out with widths measured in the real faces, on a canvas the
   * layout's size, and paints it.
   */
  private async _draw(
    theme: CardTheme,
    shape: HexShape,
    scale: number,
    photo: CanvasImageSource | null,
    layout: (measure: Measure) => ShareLayout,
  ): Promise<HTMLCanvasElement> {
    const probe = await this._canvas(1, 1, 1);
    const laid = layout(canvasMeasure(probe.ctx));
    const { canvas, ctx } = await this._canvas(laid.width, laid.height, scale);
    paintLayout(ctx, laid, this.palette(theme), shape, photo);
    return canvas;
  }

  /**
   * A blank canvas, after the faces are in: they are bundled, but a face
   * is only loaded once text asks for it, and a canvas would otherwise
   * measure and draw the first image in a fallback. `scale` draws a
   * smaller copy for a preview with the same coordinates.
   */
  private async _canvas(
    width: number,
    height: number,
    scale: number,
  ): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }> {
    this._fontsReady ??= Promise.all(
      SHARE_FONTS.map((face) => this._document.fonts.load(fontString(face))),
    );
    await this._fontsReady.catch(() => undefined);
    const canvas = this._document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    ctx.scale(scale, scale);
    return { canvas, ctx };
  }
}

const SHARE_FILE_PNG = 'motionhive-workout.png';
const SHARE_FILE_JPEG = 'motionhive-workout.jpg';

/** Closing the share sheet is a choice, not a failure. */
function isCancel(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '');
  return (
    /cancel|abort/i.test(message) || (err instanceof DOMException && err.name === 'AbortError')
  );
}
