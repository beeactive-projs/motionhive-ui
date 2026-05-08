import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../services/loading/loading.service';
import { isSilentRequest } from './silent-request.context';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  // Background calls (polling, heartbeats) don't drive the global
  // loading bar. See silent-request.context.ts for the rationale.
  if (isSilentRequest(req.context)) {
    return next(req);
  }
  const loadingService = inject(LoadingService);
  loadingService.increment();
  return next(req).pipe(finalize(() => loadingService.decrement()));
};
