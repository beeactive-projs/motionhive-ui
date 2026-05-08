import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';

@Component({
  selector: 'mh-group-tags-card',
  imports: [CardModule, TagModule],
  templateUrl: './group-tags-card.html',
  styleUrl: './group-tags-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupTagsCard {
  readonly tags = input.required<string[]>();
}
