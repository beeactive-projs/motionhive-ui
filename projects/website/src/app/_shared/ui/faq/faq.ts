import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface FaqItem {
  q: string;
  a: string;
}

/**
 * FAQ accordion — native `<details>`/`<summary>` (works with no JS, and the
 * Q&A text is fully in the prerendered HTML for crawlers). Amber +/− glyph
 * toggles with the open state. No FAQPage JSON-LD on purpose: Google retired
 * FAQ rich results (May 2026), so this stays readable content, not a schema
 * target.
 */
@Component({
  selector: 'mh-faq',
  template: `
    <div class="faq">
      @for (item of items(); track item.q; let first = $first) {
        <details class="faq__item" [open]="first && openFirst()">
          <summary class="faq__q">
            <span>{{ item.q }}</span>
            <span class="faq__i" aria-hidden="true"></span>
          </summary>
          <div class="faq__a">{{ item.a }}</div>
        </details>
      }
    </div>
  `,
  styleUrl: './faq.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Faq {
  readonly items = input.required<FaqItem[]>();
  readonly openFirst = input(true);
}
