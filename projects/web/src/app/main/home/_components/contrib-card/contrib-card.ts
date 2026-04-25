import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Hex, HexTone } from '../hex/hex';

/**
 * One of the three "Help build the hive" cards: hex glyph, title, body
 * paragraph, action button. The CTA emits — the parent decides what to
 * do (e.g. open a feedback dialog, open invite link).
 */
@Component({
  selector: 'mh-contrib-card',
  imports: [ButtonModule, Hex],
  templateUrl: './contrib-card.html',
  styleUrl: './contrib-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContribCard {
  readonly icon = input.required<string>(); // pi class, e.g. "pi pi-users"
  readonly tone = input<HexTone>('honey');
  readonly title = input.required<string>();
  readonly body = input.required<string>();
  readonly cta = input.required<string>();

  readonly ctaClick = output<void>();
}
