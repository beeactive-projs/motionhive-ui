import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Feedback } from './_shared/components/feedback/feedback';
import { ErrorDialog } from './_shared/components/error-dialog/error-dialog';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Feedback, ErrorDialog],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly title = signal('web');
}
