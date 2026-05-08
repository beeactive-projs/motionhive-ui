import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { Badge } from 'primeng/badge';
import { Tab, TabList, Tabs } from 'primeng/tabs';
import { filter, map, startWith } from 'rxjs';

@Component({
  selector: 'mh-group-tabs',
  imports: [Tabs, TabList, Tab, Badge],
  templateUrl: './group-tabs.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupTabs {
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);

  readonly membersCount = input<number | null>(null);

  readonly tabs = computed<MenuItem[]>(() => [
    { id: 'posts', label: 'Posts' },
    { id: 'members', label: 'Members', badge: this.membersCount()?.toString() },
    { id: 'about', label: 'About' },
  ]);

  readonly activeTab = toSignal(
    this._router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map(() => this._route.firstChild?.snapshot.url[0]?.path ?? 'posts'),
    ),
    { initialValue: this._route.firstChild?.snapshot.url[0]?.path ?? 'posts' },
  );

  onTabChange(value: string | number | undefined): void {
    if (typeof value !== 'string' || value === this.activeTab()) return;
    this._router.navigate([value], { relativeTo: this._route });
  }
}
