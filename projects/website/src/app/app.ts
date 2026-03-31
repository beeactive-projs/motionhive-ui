import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FeedbackDialog } from './_shared/feedback-dialog/feedback-dialog';
import { WaitlistDialog } from './_shared/waitlist-dialog/waitlist-dialog';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, FeedbackDialog, WaitlistDialog],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
