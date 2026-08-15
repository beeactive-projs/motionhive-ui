import { Component, inject } from '@angular/core';
import { IonAlert } from '@ionic/angular/standalone';

import { ErrorDialogService } from 'core';

/**
 * The one place server and network failures surface.
 *
 * Core's `errorInterceptor` pushes every unhandled HTTP failure into
 * `ErrorDialogService` and rethrows. Web renders that signal; mobile did not, so
 * anything without its own error branch — a dropped connection, a 500 — failed
 * in silence. Mounted once in `app.html`, above the router outlet, so it covers
 * every screen including ones that have not been written yet.
 *
 * Screens that handle their own errors are unaffected: the interceptor skips
 * requests marked `silentRequest()`, and an inline retry is still the better
 * experience where a screen bothers to offer one.
 */
@Component({
  selector: 'mh-error-dialog',
  imports: [IonAlert],
  templateUrl: './error-dialog.html',
})
export class ErrorDialog {
  private readonly _errorDialogService = inject(ErrorDialogService);

  readonly error = this._errorDialogService.error;
  readonly isOpen = this._errorDialogService.isOpen;

  readonly buttons = [{ text: 'OK', role: 'cancel' }];

  dismiss(): void {
    this._errorDialogService.close();
  }
}
