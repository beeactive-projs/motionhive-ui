import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { PublicProfileStore } from 'core';
import { MenuItem } from 'primeng/api';
import { Badge } from 'primeng/badge';
import { Tab, TabList, Tabs } from 'primeng/tabs';
import { filter, map, startWith } from 'rxjs';

/**
 * Tab strip for `/@<handle>`. Mirrors the metrics of `mh-group-tabs`
 * so the two surfaces feel like siblings. Active tab is derived from
 * the first child route segment so deep links work.
 */
@Component({
  selector: 'mh-profile-tabs',
  imports: [Tabs, TabList, Tab, Badge],
  templateUrl: './profile-tabs.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileTabs {
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);
  private readonly _store = inject(PublicProfileStore);

  readonly tabs = computed<MenuItem[]>(() => [
    { id: 'about', label: 'About' },
    {
      id: 'offerings',
      label: 'Offerings',
      badge: nonZero(this._store.offerings()?.length ?? null),
    },
    {
      id: 'groups',
      label: 'Groups',
      badge: nonZero(this._store.groups()?.length ?? null),
    },
    {
      id: 'reviews',
      label: 'Reviews',
      badge: nonZero(this._store.profile()?.rating?.total ?? null),
    },
  ]);

  readonly activeTab = toSignal(
    this._router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map(() => this._route.firstChild?.snapshot.url[0]?.path ?? 'about'),
    ),
    {
      initialValue: this._route.firstChild?.snapshot.url[0]?.path ?? 'about',
    },
  );

  onTabChange(value: string | number | undefined): void {
    if (typeof value !== 'string' || value === this.activeTab()) return;
    void this._router.navigate([value], { relativeTo: this._route });
  }
}

function nonZero(n: number | null): string | undefined {
  if (n == null || n === 0) return undefined;
  return String(n);
}
