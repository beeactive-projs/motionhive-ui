import { DOCUMENT, Service, inject } from '@angular/core';
import { App as CapacitorApp } from '@capacitor/app';

import { rootFontSizePercent } from '../config/text-size.config';

/**
 * Makes the app's text follow the phone's text size, from 100% at the
 * default setting up to 130% (the math and the limits are in
 * text-size.config.ts).
 *
 * Every size in the theme is rem, so this sets one thing: the root font
 * size. Ionic's own dynamic font is switched off in variables.css, because
 * it pins the root to iOS's body style, which is 17px at the default size
 * and has no ceiling; Android's WebView scales text by itself, with none
 * either.
 *
 * It measures with two hidden probes rather than asking a plugin: a line of
 * 100px text shows the WebView's text zoom (Android), and, where the platform
 * is iOS, a line set in `-apple-system-body` shows the Dynamic Type size.
 * Each is a line box at `line-height: 1`, because a text zoom grows the text
 * but not the boxes around it, so a box sized in `em` would not show it.
 * Measured again whenever the app becomes active, since the setting can
 * change while it is in the background or under Control Center.
 *
 * Android's cap needs the native side too: MainActivity clamps the WebView
 * text zoom to 100 to 130, and this then leaves the root alone there.
 */
@Service()
export class TextSizeService {
  private readonly _document = inject(DOCUMENT);

  constructor() {
    this.apply();
    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) this.apply();
    }).catch(() => {
      // No app state to follow: the size measured at launch stands.
    });
  }

  /** Measures the phone's text size and sets the root to match. */
  apply(): void {
    const percent = rootFontSizePercent(this.measureAppleBody(), this.measureTextZoom());
    const root = this._document.documentElement.style;
    if (percent === 100) root.removeProperty('font-size');
    else root.setProperty('font-size', `${percent}%`);
  }

  /** The factor a 100px font size really renders at: Android's text zoom, 1 elsewhere. */
  private measureTextZoom(): number {
    return this.lineHeight('font-size: 100px') / 100;
  }

  /**
   * The size of iOS's body text style, or null off iOS. Gated the way Ionic
   * gates its own dynamic font: desktop WebKit knows the font too, but at
   * the Mac's 13px, which has nothing to do with a phone setting.
   */
  private measureAppleBody(): number | null {
    if (!CSS.supports('-webkit-touch-callout', 'none')) return null;
    if (!CSS.supports('font', '-apple-system-body')) return null;
    return this.lineHeight('font: -apple-system-body');
  }

  /** The height of one hidden line of text at `line-height: 1`: its font size as rendered. */
  private lineHeight(font: string): number {
    const line = this._document.createElement('div');
    line.setAttribute('aria-hidden', 'true');
    line.textContent = 'M';
    line.style.cssText = `position: absolute; visibility: hidden; pointer-events: none; white-space: nowrap; ${font}; line-height: 1`;
    this._document.body.appendChild(line);
    const height = line.getBoundingClientRect().height;
    line.remove();
    return height;
  }
}
