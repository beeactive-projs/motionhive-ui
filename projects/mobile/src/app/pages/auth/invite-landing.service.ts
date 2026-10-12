import { Service, inject } from '@angular/core';
import { NavController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';

import { APP_HOME_URL } from 'core';
import { FeedbackService } from '../../_shared/services/feedback.service';

/**
 * Where an accepted client invite lands. Web opens the profile's Coaches tab;
 * mobile has no coaches screen, so it goes home and confirms with a toast.
 */
@Service()
export class InviteLandingService {
  private readonly _navController = inject(NavController);
  private readonly _feedbackService = inject(FeedbackService);
  private readonly _translateService = inject(TranslateService);
  private readonly _appHomeUrl = inject(APP_HOME_URL);

  async open(): Promise<void> {
    await this._navController.navigateRoot(this._appHomeUrl);
    void this._feedbackService.success(this._translateService.instant('auth.invite.accepted'));
  }
}
