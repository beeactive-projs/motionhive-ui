import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FeedbackDialog, WaitlistDialog } from 'core';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, FeedbackDialog, WaitlistDialog],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
