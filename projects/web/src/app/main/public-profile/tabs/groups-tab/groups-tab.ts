import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicProfileStore } from 'core';
import { Card } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';

@Component({
  selector: 'mh-public-profile-groups-tab',
  imports: [RouterLink, Card, SkeletonModule, TagModule],
  templateUrl: './groups-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupsTab implements OnInit {
  private readonly _store = inject(PublicProfileStore);

  readonly groups = this._store.groups;
  readonly loading = this._store.loadingGroups;

  ngOnInit(): void {
    this._store.loadGroups();
  }
}
