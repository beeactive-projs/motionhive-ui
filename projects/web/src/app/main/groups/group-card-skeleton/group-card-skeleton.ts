import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Card } from 'primeng/card';
import { Skeleton } from 'primeng/skeleton';

@Component({
  selector: 'mh-group-card-skeleton',
  imports: [Card, Skeleton],
  templateUrl: './group-card-skeleton.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupCardSkeleton {}
