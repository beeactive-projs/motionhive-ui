import { ChangeDetectionStrategy, Component, DOCUMENT, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Hex, SIGNUP_URL } from 'core';

import { SeoService } from '../_shared/seo.service';
import { isRoLocale, SITE_LOGO_URL, SITE_ORIGIN, siteUrl } from '../_shared/site.const';

@Component({
  selector: 'mh-about',
  imports: [RouterLink, Hex],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutComponent {
  readonly signupUrl = SIGNUP_URL;

  constructor() {
    const isRo = isRoLocale(inject(DOCUMENT));
    const seo = inject(SeoService);

    seo.set({
      title: $localize`:@@about.meta.title:About MotionHive: free coaching software, built in the open`,
      description: $localize`:@@about.meta.description:MotionHive is free software for independent coaches: run your bookable profile, sessions, programs, payments and community in one place. See why we built it.`,
      image: SITE_LOGO_URL,
    });

    // AboutPage ties this route to the brand entity + site defined on the home page.
    seo.setJsonLd('ld-about', {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      '@id': `${siteUrl('/about', isRo)}#webpage`,
      url: siteUrl('/about', isRo),
      name: $localize`:@@about.meta.title:About MotionHive: free coaching software, built in the open`,
      inLanguage: isRo ? 'ro' : 'en',
      isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
      about: { '@id': `${SITE_ORIGIN}/#organization` },
      mainEntity: { '@id': `${SITE_ORIGIN}/#organization` },
    });
  }
}
