import { Service, inject } from '@angular/core';
import { Observable, map, of, tap } from 'rxjs';

import { WorkoutLogService } from 'core';

/** The longest edge kept; the API caps at the same, so nothing is sent to be thrown away. */
const MAX_EDGE = 2048;
const JPEG_QUALITY = 0.85;

/**
 * A picked photo as it is sent: decoded, turned upright, scaled down and
 * written out again as a fresh JPEG. A canvas writes no metadata at all,
 * so the location a phone camera embeds never leaves the device. (The API
 * strips it again anyway.) HEIC from an iPhone arrives already converted
 * by the file picker.
 */
export async function preparePhoto(file: Blob): Promise<Blob> {
  // `from-image` applies the EXIF rotation before the EXIF is dropped.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the photo'))),
      'image/jpeg',
      JPEG_QUALITY,
    ),
  );
}

/**
 * Workout photos as object URLs, one per workout and version. The bytes
 * only come through the API (there is no public link), so each is fetched
 * once and reused: by the summary's hero, by the share card, and again
 * when the workout is reopened. History's grid asks for small crops,
 * cached apart.
 */
@Service()
export class WorkoutPhotoStore {
  private readonly _workoutLogService = inject(WorkoutLogService);
  private readonly _urls = new Map<string, { version: number | null; url: string }>();
  /** History's grid: small crops, cached apart from the whole photos. */
  private readonly _thumbs = new Map<string, { version: number | null; url: string }>();

  /** The photo's URL, fetched unless this version is already here. */
  url(logId: string, version: number | null): Observable<string> {
    const cached = this._urls.get(logId);
    if (cached && cached.version === version) return of(cached.url);
    return this._workoutLogService
      .getPhoto(logId)
      .pipe(map((blob) => this.keep(logId, version, blob)));
  }

  /** A small 3:4 crop for a grid of photos, fetched unless this version is here. */
  thumbUrl(logId: string, version: number | null): Observable<string> {
    const cached = this._thumbs.get(logId);
    if (cached && cached.version === version) return of(cached.url);
    return this._workoutLogService.getPhoto(logId, 'thumb').pipe(
      map((blob) => {
        const old = this._thumbs.get(logId);
        if (old) URL.revokeObjectURL(old.url);
        const url = URL.createObjectURL(blob);
        this._thumbs.set(logId, { version, url });
        return url;
      }),
    );
  }

  /** Uploads a prepared photo, and keeps the local copy so nothing is fetched back. */
  upload(logId: string, jpeg: Blob): Observable<{ url: string; version: number }> {
    return this._workoutLogService.uploadPhoto(logId, jpeg).pipe(
      map(({ photoVersion }) => ({
        url: this.keep(logId, photoVersion, jpeg),
        version: photoVersion,
      })),
    );
  }

  remove(logId: string): Observable<void> {
    return this._workoutLogService.deletePhoto(logId).pipe(tap(() => this._forget(logId)));
  }

  private keep(logId: string, version: number | null, blob: Blob): string {
    this._forget(logId);
    const url = URL.createObjectURL(blob);
    this._urls.set(logId, { version, url });
    return url;
  }

  private _forget(logId: string): void {
    for (const cache of [this._urls, this._thumbs]) {
      const cached = cache.get(logId);
      if (cached) URL.revokeObjectURL(cached.url);
      cache.delete(logId);
    }
  }
}
