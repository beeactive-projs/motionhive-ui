import { Service, inject } from '@angular/core';
import { Observable, map, of, tap } from 'rxjs';

import { WorkoutLogService } from 'core';

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
