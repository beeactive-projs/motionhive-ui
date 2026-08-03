import { ChangeDetectionStrategy, Component, computed, DOCUMENT, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Hex, SIGNUP_URL } from 'core';

import { SeoService } from '../../_shared/seo.service';
import { isRoLocale, siteUrl } from '../../_shared/site.const';
import { featureBySlug, relatedFeatures } from '../../_data/features';
import { Kicker } from '../../_shared/ui/kicker/kicker';
import { SectionHeader } from '../../_shared/ui/section-header/section-header';
import { CheckList } from '../../_shared/ui/check-list/check-list';
import { CtaBand } from '../../_shared/ui/cta-band/cta-band';
import { MediaDemo } from '../../_shared/ui/media-demo/media-demo';
import { FeatureCard } from '../../_shared/ui/feature-card/feature-card';
import { Faq } from '../../_shared/ui/faq/faq';

/**
 * One template for all 7 feature pages — everything comes from the FEATURES
 * data, so the pages can't drift from each other or from the mega-menu.
 * Unknown slugs bounce back to the overview.
 */
@Component({
  selector: 'mh-feature-detail',
  imports: [RouterLink, Hex, Kicker, SectionHeader, CheckList, CtaBand, MediaDemo, FeatureCard, Faq],
  templateUrl: './feature-detail.component.html',
  styleUrl: './feature-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureDetailComponent {
  private readonly _router = inject(Router);
  private readonly _seo = inject(SeoService);
  private readonly _isRo = isRoLocale(inject(DOCUMENT));

  readonly signupUrl = SIGNUP_URL;

  readonly feature = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((p) => featureBySlug(p.get('slug') ?? ''))),
    { initialValue: undefined },
  );

  readonly related = computed(() => {
    const f = this.feature();
    return f ? relatedFeatures(f) : [];
  });

  constructor() {
    effect(() => {
      const f = this.feature();
      if (!f) {
        void this._router.navigate(['/features']);
        return;
      }

      this._seo.set({ title: f.metaTitle, description: f.metaDescription });
      this._seo.setJsonLd('ld-breadcrumb', {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Features', item: siteUrl('/features', this._isRo) },
          {
            '@type': 'ListItem',
            position: 2,
            name: f.name,
            item: siteUrl(`/features/${f.slug}`, this._isRo),
          },
        ],
      });
    });
  }
}
