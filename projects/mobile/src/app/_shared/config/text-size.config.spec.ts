import { describe, expect, it } from 'vitest';

import {
  TEXT_SIZE,
  clampTextScale,
  rootFontSizePercent,
  systemTextScale,
} from './text-size.config';

describe('systemTextScale', () => {
  it('is 1 at the default size on both platforms', () => {
    expect(systemTextScale(17, 1)).toBe(1);
    expect(systemTextScale(null, 1)).toBe(1);
  });

  it('reads iOS Dynamic Type from the body style, 17px at the default', () => {
    expect(systemTextScale(19, 1)).toBeCloseTo(19 / 17);
    expect(systemTextScale(23, 1)).toBeCloseTo(23 / 17);
    expect(systemTextScale(14, 1)).toBeCloseTo(14 / 17);
  });

  it("reads Android's font scale from the WebView text zoom", () => {
    expect(systemTextScale(null, 1.15)).toBeCloseTo(1.15);
    expect(systemTextScale(null, 2)).toBe(2);
  });

  it('ignores readings no phone gives', () => {
    // An unsupported font leaves the probe at its own size; a probe that
    // never laid out measures 0.
    expect(systemTextScale(100, 1)).toBe(1);
    expect(systemTextScale(0, 1)).toBe(1);
    expect(systemTextScale(Number.NaN, 1)).toBe(1);
    expect(systemTextScale(null, 0)).toBe(1);
    expect(systemTextScale(null, Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe('clampTextScale', () => {
  it('passes a scale inside the limits through', () => {
    expect(clampTextScale(1.15)).toBe(1.15);
  });

  it('never goes under the designed size', () => {
    expect(clampTextScale(0.82)).toBe(TEXT_SIZE.minScale);
  });

  it('stops at 130%', () => {
    expect(clampTextScale(3.1)).toBe(TEXT_SIZE.maxScale);
    expect(TEXT_SIZE.maxScale).toBe(1.3);
  });

  it('falls back to the designed size on a broken number', () => {
    expect(clampTextScale(Number.NaN)).toBe(TEXT_SIZE.minScale);
  });
});

describe('rootFontSizePercent', () => {
  it('changes nothing at the default size', () => {
    expect(rootFontSizePercent(17, 1)).toBe(100);
    expect(rootFontSizePercent(null, 1)).toBe(100);
  });

  it('scales iOS up to the cap', () => {
    // xLarge (19px) and xxxLarge (23px, capped), then the largest
    // accessibility size (53px, capped).
    expect(rootFontSizePercent(19, 1)).toBe(111.76);
    expect(rootFontSizePercent(23, 1)).toBe(130);
    expect(rootFontSizePercent(53, 1)).toBe(130);
  });

  it('keeps iOS at the designed size when the phone asks for smaller text', () => {
    expect(rootFontSizePercent(14, 1)).toBe(100);
  });

  it("divides out Android's text zoom where that leaves every box its size", () => {
    // 1.15 is under the cap: the zoom already gives it, so the root is left.
    expect(rootFontSizePercent(null, 1.15)).toBe(100);
    // 85% is floored: 16px × 117.65% × 0.85 = 16px of text.
    expect(rootFontSizePercent(null, 0.85)).toBe(117.65);
  });

  it('never shrinks the root under a zoom past the cap', () => {
    // 65% would cap the text at 20.8px but shrink every rem box, tap targets
    // included, to 65% with it. The native text zoom cap does this instead.
    expect(rootFontSizePercent(null, 2)).toBe(100);
  });

  it('lands rem on 16px × the clamped scale on iOS', () => {
    const remPx = (appleBodyPx: number) => 16 * (rootFontSizePercent(appleBodyPx, 1) / 100);
    expect(remPx(17)).toBe(16);
    expect(remPx(21)).toBeCloseTo(16 * (21 / 17), 1);
    expect(remPx(40)).toBeCloseTo(20.8, 1);
  });

  it('keeps Android text between 16px and the cap while the zoom is within it', () => {
    const textPx = (zoom: number) => 16 * (rootFontSizePercent(null, zoom) / 100) * zoom;
    expect(textPx(1)).toBe(16);
    expect(textPx(0.85)).toBeCloseTo(16, 1);
    expect(textPx(1.3)).toBeCloseTo(20.8, 1);
  });
});
