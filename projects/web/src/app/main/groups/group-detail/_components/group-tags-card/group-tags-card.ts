import { Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';

@Component({
  selector: 'mh-group-tags-card',
  imports: [CardModule, TagModule, TranslatePipe],
  templateUrl: './group-tags-card.html',
  styleUrl: './group-tags-card.scss',
})
export class GroupTagsCard {
  readonly tags = input.required<string[]>();
}
