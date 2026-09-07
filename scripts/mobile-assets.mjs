// Generates the native app icon + splash screens for the Ionic/Capacitor mobile app.
//
//   npm run mobile:assets
//
// 1. Renders properly sized PNG sources into projects/mobile/resources/ from the
//    brand SVG marks in projects/web/public/svg (single source of truth for the logo).
// 2. Runs @capacitor/assets in "custom mode" against those sources, which writes the
//    iOS AppIcon/Splash asset catalogs (light + dark) and the Android mipmap/drawable
//    resources (light + night).
// 3. Re-writes the Android adaptive icon layers itself. The tool emits them at the legacy
//    48 dp sizes (192 px at xxxhdpi) and insets them 16.7% via XML, so launchers upscale a
//    small bitmap and the edges go soft. We render full 108 dp canvases per density, apply
//    a small optical nudge (the open-cornered hexagon reads as sitting low-right when it is
//    geometrically centred), and point mipmap-anydpi-v26/ic_launcher*.xml at them with no
//    inset. The same layer doubles as the Android 13 themed (monochrome) icon.
//
// The Android 12+ *system* splash (shown before the Capacitor one) takes its colour from
// android/app/src/main/res/values{,-night}/colors.xml, not from these images.
//
// Brand rule (CLAUDE.md): navy mark on light surfaces, honey mark on dark ones.
// Backgrounds match --ion-background-color light/dark so splash → first paint is seamless.

import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const svgDir = join(root, 'projects/web/public/svg');
const outDir = join(root, 'projects/mobile/resources');
const androidRes = join(root, 'android/app/src/main/res');

const NAVY_MARK = join(svgDir, 'logo-navy.svg'); // fill #1e3a5f
const HONEY_MARK = join(svgDir, 'logo-honey.svg'); // fill #f59e0b

const HONEY = '#f59e0b'; // --mh-primary-500
const SLATE_50 = '#f8fafc'; // light --ion-background-color
const NAVY_900 = '#0e1b31'; // dark --ion-background-color

const MARK_ASPECT = 168 / 190; // logo-*.svg viewBox is 168×190

const ICON = 1024;
const SPLASH = 2732;

// Android adaptive icon: 108 dp canvas, central 72 dp visible, 66 dp safe circle.
const ADAPTIVE_CANVAS_DP = 108;
const ADAPTIVE_VISIBLE_DP = 72;
const ANDROID_DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
// Optional optical correction, as a fraction of the visible area, applied up and left.
// 0 = geometrically centred (a 1.5% nudge was tried and read as off-centre on device).
const ADAPTIVE_OPTICAL_NUDGE = 0;

/** Render an SVG mark at an exact pixel height (density-based so it stays crisp). */
async function renderMark(svgPath, height) {
  const width = Math.round(height * MARK_ASPECT);
  const density = (72 * height) / 190;
  return sharp(svgPath, { density }).resize(width, height, { fit: 'inside' }).png().toBuffer();
}

/** Solid (or transparent) square canvas with a mark composited in the centre. */
async function compose(size, background, mark, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  const composite = mark ? [{ input: mark, gravity: 'centre' }] : [];
  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite(composite)
    .png()
    .toFile(dest);
  console.log('wrote', dest);
}

async function writeSources() {
  // iOS icon + Android legacy icon: honey tile, navy mark at the same proportions as
  // logo-bg-honey.svg (190/230 of the tile). The OS rounds the corners.
  await compose(ICON, HONEY, await renderMark(NAVY_MARK, Math.round(ICON * (190 / 230))), join(outDir, 'icon-only.png'));

  // Android adaptive icon layers. @capacitor/assets insets the foreground by 16.7%, so the
  // 1024 canvas maps onto the 72dp visible area; the 66dp safe circle is ~92% of it.
  // 70% mark height keeps the hexagon well inside every launcher mask.
  await compose(ICON, { r: 0, g: 0, b: 0, alpha: 0 }, await renderMark(NAVY_MARK, Math.round(ICON * 0.7)), join(outDir, 'icon-foreground.png'));
  await compose(ICON, HONEY, null, join(outDir, 'icon-background.png'));

  // Splash: mark at 20% of the canvas width (the tool's own default for its easy mode).
  const splashMarkHeight = Math.round((SPLASH * 0.2) / MARK_ASPECT);
  await compose(SPLASH, SLATE_50, await renderMark(NAVY_MARK, splashMarkHeight), join(outDir, 'splash.png'));
  await compose(SPLASH, NAVY_900, await renderMark(HONEY_MARK, splashMarkHeight), join(outDir, 'splash-dark.png'));
}

function runCapacitorAssets() {
  execSync(`npx capacitor-assets generate --ios --android --assetPath projects/mobile/resources`, {
    cwd: root,
    stdio: 'inherit',
  });
}

/**
 * Full-size adaptive icon layers per density, replacing the ones @capacitor/assets wrote.
 * icon-foreground.png is the 72 dp visible area (mark at 70% of it), so it is scaled to
 * that and padded out to the 108 dp canvas; the nudge shifts it within the padding.
 */
async function writeAndroidAdaptiveIcon() {
  const foregroundSrc = join(outDir, 'icon-foreground.png');
  for (const [density, scale] of Object.entries(ANDROID_DENSITIES)) {
    const canvas = ADAPTIVE_CANVAS_DP * scale;
    const visible = ADAPTIVE_VISIBLE_DP * scale;
    const pad = (canvas - visible) / 2;
    const nudge = Math.round(-ADAPTIVE_OPTICAL_NUDGE * visible);
    const dir = join(androidRes, `mipmap-${density}`);

    const mark = await sharp(foregroundSrc).resize(visible, visible).png().toBuffer();
    await sharp({ create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: mark, left: pad + nudge, top: pad + nudge }])
      .png()
      .toFile(join(dir, 'ic_launcher_foreground.png'));
    await sharp({ create: { width: canvas, height: canvas, channels: 4, background: HONEY } })
      .png()
      .toFile(join(dir, 'ic_launcher_background.png'));
    console.log('wrote', dir, `adaptive layers ${canvas}px (nudge ${nudge}px)`);
  }

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`;
  for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
    writeFileSync(join(androidRes, 'mipmap-anydpi-v26', name), xml);
  }
}

await writeSources();
runCapacitorAssets();
await writeAndroidAdaptiveIcon();
