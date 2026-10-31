import { Component, computed, input } from '@angular/core';

import { highlightParts } from '../../discover.config';

/**
 * Text with the part that matched a search marked, blind to accents the way
 * the server's search is: "forta" marks "Forță" (`highlightParts`). With no
 * term it is the plain text. Inline, so the line it sits in keeps its own
 * ellipsis.
 */
@Component({
  selector: 'mh-highlight',
  templateUrl: './highlight.html',
  styleUrl: './highlight.scss',
})
export class Highlight {
  readonly text = input.required<string>();
  readonly term = input('');

  readonly parts = computed(() => highlightParts(this.text(), this.term()));
}
