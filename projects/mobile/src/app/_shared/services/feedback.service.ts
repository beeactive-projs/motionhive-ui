import { Service, inject } from '@angular/core';
import { ToastController } from '@ionic/angular/standalone';

import { apiErrorMessage } from 'core';

const SUCCESS_DURATION_MS = 1500;
const ERROR_DURATION_MS = 3000;

/**
 * Toast feedback for the screens that write.
 *
 * Core's `showApiError` is the equivalent helper on web, but it takes PrimeNG's
 * `MessageService` and cannot be used here — so this wraps Ionic's
 * `ToastController` around the same `apiErrorMessage` extraction, rather than
 * every save site re-deriving a message from the error shape.
 */
@Service()
export class FeedbackService {
  private readonly _toastController = inject(ToastController);

  async success(message: string): Promise<void> {
    await this._present(message, 'success', SUCCESS_DURATION_MS);
  }

  /** Neutral confirmation — "No changes", and other non-events. */
  async info(message: string): Promise<void> {
    await this._present(message, 'medium', SUCCESS_DURATION_MS);
  }

  async error(error: unknown, fallback: string): Promise<void> {
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
}
