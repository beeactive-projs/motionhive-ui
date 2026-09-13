import { Service, inject } from '@angular/core';
import { ToastController } from '@ionic/angular/standalone';
import { Haptics, NotificationType } from '@capacitor/haptics';

import { ErrorDialogService, apiErrorMessage } from 'core';

const SUCCESS_DURATION_MS = 1500;
const ERROR_DURATION_MS = 3000;

/**
 * Toast feedback for the screens that write.
 *
 * Core's `showApiError` is the equivalent helper on web, but it takes PrimeNG's
 * `MessageService` and cannot be used here — so this wraps Ionic's
 * `ToastController` around the same `apiErrorMessage` extraction, rather than
 * every save site re-deriving a message from the error shape.
 *
 * Haptics ride along with the toast rather than being fired at call sites: the
 * outcome is already expressed here once, and a buzz per save site would drift
 * out of sync with what the toast says. `Haptics` no-ops on the web build.
 */
@Service()
export class FeedbackService {
  private readonly _toastController = inject(ToastController);
  private readonly _errorDialog = inject(ErrorDialogService);

  async success(message: string): Promise<void> {
    void this._vibrate(NotificationType.Success);
    await this._present(message, 'success', SUCCESS_DURATION_MS);
  }

  /** Neutral confirmation — "No changes", and other non-events. */
  async info(message: string): Promise<void> {
    await this._present(message, 'medium', SUCCESS_DURATION_MS);
  }

  /**
   * Report a failed write where it happened.
   *
   * Core's interceptor has already queued its generic dialog for this
   * response by the time the caller gets here; a toast that names the
   * action ("Could not copy the week") says it better, so the dialog is
   * withdrawn before it renders. Screens that report nothing still get
   * the dialog — this only replaces it, never silences it.
   */
  async error(error: unknown, fallback: string): Promise<void> {
    const status = (error as { status?: number } | null)?.status;
    if (status !== undefined && this._errorDialog.error()?.status === status) {
      this._errorDialog.close();
    }
    void this._vibrate(NotificationType.Error);
    await this._present(apiErrorMessage(error, fallback), 'danger', ERROR_DURATION_MS);
  }

  private async _present(message: string, color: string, duration: number): Promise<void> {
    const toast = await this._toastController.create({
      message,
      color,
      duration,
      position: 'bottom',
    });
    await toast.present();
  }

  /** Never let a missing taptic engine take a save down with it. */
  private async _vibrate(type: NotificationType): Promise<void> {
    try {
      await Haptics.notification({ type });
    } catch {
      // No haptics on this device or platform.
    }
  }
}
