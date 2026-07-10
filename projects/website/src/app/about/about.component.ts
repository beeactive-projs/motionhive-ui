import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Hex } from 'core';

import { SeoService } from '../_shared/seo.service';

@Component({
  selector: 'mh-about',
  imports: [RouterLink, ButtonModule, Hex],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutComponent {
  constructor() {
    inject(SeoService).set({
      title: $localize`About - MotionHive`,
      description: $localize`:@@about.meta.description:MotionHive is where active communities come together — a home for organisers to run their groups and for members to find activities and stay in motion. Learn what we're building and why.`,
    });
  }
}
