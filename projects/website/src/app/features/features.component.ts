import { ChangeDetectionStrategy, Component, DOCUMENT, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Hex, type HexTone, SIGNUP_URL } from 'core';

import { SeoService } from '../_shared/seo.service';
import { isRoLocale, SITE_ORIGIN, siteUrl } from '../_shared/site.const';
import { FEATURES } from '../_data/features';
import { Kicker } from '../_shared/ui/kicker/kicker';
import { SectionHeader } from '../_shared/ui/section-header/section-header';
import { CtaBand } from '../_shared/ui/cta-band/cta-band';
import { FeatureCard } from '../_shared/ui/feature-card/feature-card';

interface MemberCard {
  icon: string;
  tone: HexTone;
  title: string;
  body: string;
}
interface RoadmapLane {
  key: 'now' | 'soon' | 'exploring';
  label: string;
  items: string[];
}

@Component({
  selector: 'mh-features',
  imports: [RouterLink, Hex, Kicker, SectionHeader, CtaBand, FeatureCard],
  templateUrl: './features.component.html',
  styleUrl: './features.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturesComponent {
  readonly features = FEATURES;
  readonly signupUrl = SIGNUP_URL;

  readonly members: MemberCard[] = [
    {
      icon: '🔎',
      tone: 'teal',
      title: $localize`:@@features.m1.t:Find a coach who fits`,
      body: $localize`:@@features.m1.b:Browse coaches and groups near you, see what they actually run, and book in one tap.`,
    },
    {
      icon: '📈',
      tone: 'amber',
      title: $localize`:@@features.m2.t:Follow your plan`,
      body: $localize`:@@features.m2.b:Your program, your sessions and your history live in one place instead of a chat thread.`,
    },
    {
      icon: '🏋️',
      tone: 'navy',
      title: $localize`:@@features.m3.t:Know every movement`,
      body: $localize`:@@features.m3.b:Each exercise comes with a clip and cues, so you are never guessing at the rack.`,
    },
  ];

  readonly roadmap: RoadmapLane[] = [
    {
      key: 'now',
      label: $localize`:@@features.rm.now:Available now`,
      items: FEATURES.map((f) => f.name),
    },
    {
      key: 'soon',
      label: $localize`:@@features.rm.soon:Coming soon`,
      items: [
        $localize`:@@features.rm.s1:Mobile app`,
        $localize`:@@features.rm.s2:Nutrition and meal plans`,
        $localize`:@@features.rm.s3:Group messaging`,
      ],
    },
    {
      key: 'exploring',
      label: $localize`:@@features.rm.exp:Exploring`,
      items: [
        $localize`:@@features.rm.e1:Studios and teams`,
        $localize`:@@features.rm.e2:Deeper scheduling`,
        $localize`:@@features.rm.e3:Challenges and goals`,
      ],
    },
  ];

  constructor() {
    const seo = inject(SeoService);
    const isRo = isRoLocale(inject(DOCUMENT));

    seo.set({
      title: $localize`:@@features.meta.title:Features — everything you need to coach online | MotionHive`,
      description: $localize`:@@features.meta.description:Storefront, sessions, programs, exercises, payments, messaging and community. Every MotionHive feature is free, with unlimited clients and no subscription.`,
    });

    seo.setJsonLd('ld-breadcrumb', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'MotionHive', item: siteUrl('/', isRo) },
        { '@type': 'ListItem', position: 2, name: 'Features', item: siteUrl('/features', isRo) },
      ],
    });
  }

  protected readonly siteOrigin = SITE_ORIGIN;
}
