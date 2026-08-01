import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Hex } from 'core';

import { SeoService } from '../_shared/seo.service';

@Component({
  selector: 'mh-about',
  imports: [RouterLink, Hex],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutComponent {
  constructor() {
    inject(SeoService).set({
      title: $localize`:@@about.meta.title:About MotionHive: free coaching software, built in the open`,
      description: $localize`:@@about.meta.description:MotionHive is a home for active communities: organisers run their groups, members find activities and stay in motion. See what we're building and why.`,
    });
  }
}
