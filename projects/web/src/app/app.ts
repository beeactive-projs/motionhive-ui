import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';
import { environment } from 'core';
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

  private readonly _meta = inject(Meta);

  constructor() {
    const imageUrl = `${environment.appUrl}/svg/logo-white.svg`;
    this._meta.addTags([
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: environment.appUrl },
      { property: 'og:title', content: 'BeeActive' },
      { property: 'og:description', content: 'Your fitness platform description here.' },
      { property: 'og:image', content: imageUrl },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'BeeActive' },
      { name: 'twitter:description', content: 'Your fitness platform description here.' },
      { name: 'twitter:image', content: imageUrl },
    ]);
  }
}
