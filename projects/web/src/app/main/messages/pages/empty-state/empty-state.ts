import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * EmptyState — shown in the right pane when no conversation is selected
 * (URL: `/messages`). Replaces itself with the conversation pane when
 * the user clicks a row (URL: `/messages/:id`, added in F3).
 *
 * Mirrors the design's empty-state copy verbatim per the handoff §5.3.
 */
@Component({
  selector: 'mh-messages-empty-state',
  imports: [],
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyState {}
