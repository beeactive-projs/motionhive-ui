import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import type {
  ExerciseProgress,
  ProgressOverview,
  ProgressRange,
} from '../../models/workout/progress.model';

const BASE = '/progress';

/** Read-only. Progress is derived; nothing here writes. */
@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly _http = inject(HttpClient);
  private readonly _base = `${environment.apiUrl}${BASE}`;

  overview(range: ProgressRange = '12w'): Observable<ProgressOverview> {
    return this._http.get<ProgressOverview>(`${this._base}/overview`, {
      params: new HttpParams().set('range', range),
    });
  }

  forExercise(exerciseId: string): Observable<ExerciseProgress> {
    return this._http.get<ExerciseProgress>(
      `${this._base}/exercises/${exerciseId}`,
    );
  }
}
