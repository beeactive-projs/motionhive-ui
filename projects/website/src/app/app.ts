import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FeedbackDialog } from './_shared/feedback-dialog/feedback-dialog';
import { WaitlistDialog } from './_shared/waitlist-dialog/waitlist-dialog';
import { CookieConsentService } from './_shared/cookie-consent/cookie-consent.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, FeedbackDialog, WaitlistDialog],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  private readonly cookieConsent = inject(CookieConsentService);

  ngOnInit(): void {
    this.cookieConsent.init();
  }
}
