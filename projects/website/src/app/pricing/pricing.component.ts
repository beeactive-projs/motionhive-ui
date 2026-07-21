import { ChangeDetectionStrategy, Component, DOCUMENT, inject } from '@angular/core';
import { Hex, type HexTone, SIGNUP_URL } from 'core';

import { SeoService } from '../_shared/seo.service';
import { isRoLocale, SITE_ORIGIN, siteUrl } from '../_shared/site.const';
import { Kicker } from '../_shared/ui/kicker/kicker';
import { SectionHeader } from '../_shared/ui/section-header/section-header';
import { CheckList } from '../_shared/ui/check-list/check-list';
import { CtaBand } from '../_shared/ui/cta-band/cta-band';
import { Faq, type FaqItem } from '../_shared/ui/faq/faq';

interface NoCatch {
  icon: string;
  tone: HexTone;
  title: string;
  body: string;
}
interface CompareRow {
  label: string;
  mh: string;
  them: string;
}

@Component({
  selector: 'mh-pricing',
  imports: [Hex, Kicker, SectionHeader, CheckList, CtaBand, Faq],
  templateUrl: './pricing.component.html',
  styleUrl: './pricing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PricingComponent {
  readonly signupUrl = SIGNUP_URL;

  readonly planFeatures = [
    $localize`:@@pricing.pf1:Unlimited clients`,
    $localize`:@@pricing.pf2:Your bookable storefront`,
    $localize`:@@pricing.pf3:Sessions and scheduling`,
    $localize`:@@pricing.pf4:Programs and exercise library`,
    $localize`:@@pricing.pf5:Payments: invoices, subscriptions, products`,
    $localize`:@@pricing.pf6:Messaging with clients`,
    $localize`:@@pricing.pf7:Groups and community`,
    $localize`:@@pricing.pf8:No subscription to manage your clients`,
  ];

  readonly noCatch: NoCatch[] = [
    {
      icon: '♾️',
      tone: 'amber',
      title: $localize`:@@pricing.nc1.t:Unlimited and free`,
      body: $localize`:@@pricing.nc1.b:Every feature, no client cap, no paywalled tier waiting to catch you.`,
    },
    {
      icon: '⏳',
      tone: 'teal',
      title: $localize`:@@pricing.nc2.t:No trial timer`,
      body: $localize`:@@pricing.nc2.b:This is not a 14-day tease. Free is the plan, not the bait.`,
    },
    {
      icon: '💳',
      tone: 'amber',
      title: $localize`:@@pricing.nc3.t:No card to start`,
      body: $localize`:@@pricing.nc3.b:Sign up and set up your storefront without entering any payment details.`,
    },
    {
      icon: '🔒',
      tone: 'navy',
      title: $localize`:@@pricing.nc4.t:Your data is yours`,
      body: $localize`:@@pricing.nc4.b:Export anytime. We do not hold your clients or content hostage.`,
    },
  ];

  readonly compare: CompareRow[] = [
    {
      label: $localize`:@@pricing.cmp1.l:Cost`,
      mh: $localize`:@@pricing.cmp1.a:Free, no subscription`,
      them: $localize`:@@pricing.cmp1.b:Monthly subscription`,
    },
    {
      label: $localize`:@@pricing.cmp2.l:Client limit`,
      mh: $localize`:@@pricing.cmp2.a:Unlimited`,
      them: $localize`:@@pricing.cmp2.b:Tiered by headcount`,
    },
    {
      label: $localize`:@@pricing.cmp3.l:Build your own programs`,
      mh: $localize`:@@pricing.cmp3.a:Included`,
      them: $localize`:@@pricing.cmp3.b:Higher plans only`,
    },
    {
      label: $localize`:@@pricing.cmp4.l:Products and memberships`,
      mh: $localize`:@@pricing.cmp4.a:Built in`,
      them: $localize`:@@pricing.cmp4.b:Higher plans or add-on`,
    },
    {
      label: $localize`:@@pricing.cmp5.l:Community and groups`,
      mh: $localize`:@@pricing.cmp5.a:Built in`,
      them: $localize`:@@pricing.cmp5.b:Add-on or missing`,
    },
  ];

  readonly faq: FaqItem[] = [
    {
      q: $localize`:@@pricing.faq1.q:Is it really free?`,
      a: $localize`:@@pricing.faq1.a:Yes. Managing your clients is free, with no client limit and no subscription. Later we may add optional premium tools on top, but running your coaching stays free.`,
    },
    {
      q: $localize`:@@pricing.faq2.q:Do I need a credit card to start?`,
      a: $localize`:@@pricing.faq2.a:No. You can sign up and set up your storefront without entering any payment details.`,
    },
    {
      q: $localize`:@@pricing.faq3.q:How do you make money then?`,
      a: $localize`:@@pricing.faq3.a:We are building in the open. The plan is optional premium tools over time, on top of the free core. Managing your clients stays free.`,
    },
    {
      q: $localize`:@@pricing.faq4.q:Will it stay free to manage clients?`,
      a: $localize`:@@pricing.faq4.a:Yes. If premium ever arrives, it will be extra tools on top, never a paywall on running your coaching or managing the clients you already have.`,
    },
    {
      q: $localize`:@@pricing.faq5.q:Can I export my data?`,
      a: $localize`:@@pricing.faq5.a:Yes. Your clients and content are yours; you can export them and leave anytime.`,
    },
  ];

  constructor() {
    const seo = inject(SeoService);
    const isRo = isRoLocale(inject(DOCUMENT));
    const url = siteUrl('/pricing', isRo);

    const description = $localize`:@@pricing.meta.description:MotionHive is free for coaches: unlimited clients, your storefront, sessions, programs, payments and community, with no subscription to manage your clients.`;

    seo.set({
      title: $localize`:@@pricing.meta.title:Pricing: free coaching software, no subscription | MotionHive`,
      description,
    });

    // The product + its (free) offer. No aggregateRating on purpose: we have
    // no real reviews yet, and inventing one to unlock a rich result is a
    // manual-action risk, not a growth hack.
    seo.setJsonLd('ld-product', {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'MotionHive',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url,
      description,
      inLanguage: isRo ? 'ro' : 'en',
      publisher: { '@id': `${SITE_ORIGIN}/#organization` },
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        url,
      },
    });
  }
}
