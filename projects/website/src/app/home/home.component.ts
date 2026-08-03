import { ChangeDetectionStrategy, Component, DOCUMENT, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';
import { BlogService, Hex, type BlogPost, type HexTone, SIGNUP_URL } from 'core';

import { SeoService } from '../_shared/seo.service';
import { isRoLocale, SITE_LOGO_URL, SITE_ORIGIN, siteUrl } from '../_shared/site.const';
import { FEATURES } from '../_data/features';
import { Kicker } from '../_shared/ui/kicker/kicker';
import { SectionHeader } from '../_shared/ui/section-header/section-header';
import { CheckList } from '../_shared/ui/check-list/check-list';
import { CtaBand } from '../_shared/ui/cta-band/cta-band';
import { MediaDemo } from '../_shared/ui/media-demo/media-demo';
import { FeatureCard } from '../_shared/ui/feature-card/feature-card';
import { Stat } from '../_shared/ui/stat/stat';
import { BlogPostCard } from '../blog/_shared/blog-post-card/blog-post-card';

/**
 * Hero cluster hex — the pre-redesign diamond of 4 (top / two middle /
 * bottom): an airy tinted `mh-hex` with a glowing icon ring + label inside.
 * `color` drives both the light hex tint and the ring glow (via `--hh`).
 */
interface HeroHex {
  icon: string;
  label: string;
  /** Base color: light hex tint + glowing icon ring. */
  color: string;
  /** Position class suffix: 1 top, 2 middle-left, 3 middle-right, 4 bottom. */
  pos: number;
}
interface Path {
  icon: string;
  tone: HexTone;
  title: string;
  points: string[];
}
interface CommunityCard {
  icon: string;
  tone: HexTone;
  title: string;
  body: string;
}

@Component({
  selector: 'mh-home',
  imports: [
    RouterLink,
    Hex,
    Kicker,
    SectionHeader,
    CheckList,
    CtaBand,
    MediaDemo,
    FeatureCard,
    Stat,
    BlogPostCard,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  readonly features = FEATURES;
  readonly signupUrl = SIGNUP_URL;

  readonly guarantees = [
    $localize`:@@home.g1:Unlimited clients`,
    $localize`:@@home.g2:No subscription`,
    $localize`:@@home.g3:No card needed`,
  ];

  readonly heroHexes: HeroHex[] = [
    {
      icon: 'pi-calendar',
      label: $localize`:@@home.hx1:Book sessions`,
      color: 'var(--p-sky-500, #0ea5e9)',
      pos: 1,
    },
    {
      icon: 'pi-book',
      label: $localize`:@@home.hx2:Build programs`,
      color: 'var(--p-emerald-500, #10b981)',
      pos: 2,
    },
    {
      icon: 'pi-users',
      label: $localize`:@@home.hx3:Your hive`,
      color: 'var(--p-purple-500, #a855f7)',
      pos: 3,
    },
    {
      icon: 'pi-wallet',
      label: $localize`:@@home.hx4:Get paid`,
      color: 'var(--p-orange-500, #f97316)',
      pos: 4,
    },
  ];

  readonly paths: Path[] = [
    {
      icon: '🏋️',
      tone: 'amber',
      title: $localize`:@@home.coach.title:You coach.`,
      points: [
        $localize`:@@home.coach.p1:Your public, bookable coach profile`,
        $localize`:@@home.coach.p2:Programs your clients actually follow`,
        $localize`:@@home.coach.p3:Get paid for sessions, memberships and products`,
        $localize`:@@home.coach.p4:Your whole roster in one place`,
      ],
    },
    {
      icon: '🙌',
      tone: 'teal',
      title: $localize`:@@home.member.title:You show up.`,
      points: [
        $localize`:@@home.member.p1:Find coaches and book in seconds`,
        $localize`:@@home.member.p2:Follow your plan, track your training`,
        $localize`:@@home.member.p3:Message your coach between sessions`,
        $localize`:@@home.member.p4:Join the group, not a spreadsheet`,
      ],
    },
  ];

  readonly community: CommunityCard[] = [
    {
      icon: '👥',
      tone: 'teal',
      title: $localize`:@@home.comm1.t:Groups and the hive`,
      body: $localize`:@@home.comm1.b:Bring your people into one space instead of scattered chats and spreadsheets.`,
    },
    {
      icon: '💬',
      tone: 'amber',
      title: $localize`:@@home.comm2.t:Stay close`,
      body: $localize`:@@home.comm2.b:Message, share, and keep the momentum going between sessions.`,
    },
    {
      icon: '🌱',
      tone: 'navy',
      title: $localize`:@@home.comm3.t:Grows with you`,
      body: $localize`:@@home.comm3.b:Start with a handful of clients and scale to a full community, same home.`,
    },
  ];

  readonly latestPosts = toSignal(
    inject(BlogService)
      .getAllPostData()
      .pipe(
        map((posts) => posts.slice(0, 3)),
        catchError(() => of([] as BlogPost[])),
      ),
    { initialValue: [] as BlogPost[] },
  );

  constructor() {
    const seo = inject(SeoService);
    const isRo = isRoLocale(inject(DOCUMENT));

    seo.set({
      title: $localize`:@@home.meta.title:MotionHive: free coaching software for the communities you build`,
      description: $localize`:@@home.meta.description:MotionHive is free software for coaches: a bookable profile, sessions, programs, payments and community in one place. Unlimited clients, no subscription.`,
      image: SITE_LOGO_URL,
    });

    // Organization anchors the brand entity; other schemas reference it by @id.
    seo.setJsonLd('ld-org', {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${SITE_ORIGIN}/#organization`,
      name: 'MotionHive',
      url: SITE_ORIGIN,
      logo: { '@type': 'ImageObject', url: SITE_LOGO_URL },
      sameAs: [
        'https://facebook.com/motionhive.fit',
        'https://instagram.com/motionhive.fit',
        'https://www.linkedin.com/company/motionhivefit',
      ],
    });

    // WebSite without SearchAction on purpose — we have no on-site search
    // endpoint, and shipping the sitelinks-searchbox speculatively fails
    // validation.
    seo.setJsonLd('ld-website', {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${SITE_ORIGIN}/#website`,
      name: 'MotionHive',
      url: siteUrl('/', isRo),
      inLanguage: isRo ? 'ro' : 'en',
      publisher: { '@id': `${SITE_ORIGIN}/#organization` },
    });
  }
}
