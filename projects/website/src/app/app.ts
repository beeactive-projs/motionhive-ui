import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FeedbackService } from 'core';
import { FeedbackDialog } from './_shared/feedback-dialog/feedback-dialog';
import { CookieConsentService } from './_shared/cookie-consent/cookie-consent.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, FeedbackDialog],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly _cookieConsentService = inject(CookieConsentService);

  protected readonly feedbackOpen = inject(FeedbackService).isOpen;

  ngOnInit(): void {
    this._cookieConsentService.init();
  }
}
