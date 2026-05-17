import { CommonModule, Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * `mh-page-shell` — standard top-of-page chrome.
 *
 * Inputs:
 *   - `title` — the H1.
 *   - `breadcrumb` — optional crumb trail. Accepts either:
 *       - `string[]` (legacy, no nav): each label rendered as text.
 *       - `BreadcrumbItem[]`: each crumb can carry a `routerLink` so it
 *         renders as a clickable router link. Items without `routerLink`
 *         (typically the last/current crumb) render as text.
 *   - `showBack` — when true, renders a "← Back" button left of the
 *     title that calls `Location.back()`. Use on deep pages where the
 *     sidebar isn't enough.
 *
 * Slots:
 *   - `<ng-content select="[actions]">` — buttons / controls in the header.
 *   - `<ng-content>` — page body.
 *
 * No state, no HTTP, no domain types. Adopt-as-follow-up across every
 * authenticated page in the app.
 */
export interface BreadcrumbItem {
  label: string;
  /** When set, the crumb renders as a router link to this path. */
  routerLink?: string | string[];
}

type CrumbInput = string | BreadcrumbItem;

@Component({
  selector: 'mh-page-shell',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mh-page-shell">
      <header class="mh-page-shell__header">
        <div class="mh-page-shell__title-block">
          @if (breadcrumb?.length) {
            <nav class="mh-page-shell__breadcrumb" aria-label="breadcrumb">
              @for (crumb of normalizedCrumbs(); track $index; let last = $last) {
                @if (crumb.routerLink && !last) {
                  <a
                    [routerLink]="crumb.routerLink"
                    class="mh-page-shell__crumb-link"
                  >{{ crumb.label }}</a>
                } @else {
                  <span [class.is-current]="last">{{ crumb.label }}</span>
                }
                @if (!last) {
                  <span class="mh-page-shell__crumb-sep" aria-hidden="true">/</span>
                }
              }
            </nav>
          }
          <div class="mh-page-shell__title-row">
            @if (showBack) {
              <button
                type="button"
                class="mh-page-shell__back"
                (click)="back()"
                aria-label="Back"
              >
                <i class="pi pi-arrow-left" aria-hidden="true"></i>
              </button>
            }
            <h1 class="mh-page-shell__title">{{ title }}</h1>
          </div>
        </div>
        <div class="mh-page-shell__actions">
          <ng-content select="[actions]"></ng-content>
        </div>
      </header>
      <div class="mh-page-shell__body">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: `
    .mh-page-shell { display: flex; flex-direction: column; gap: 16px; }
    .mh-page-shell__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
      flex-wrap: wrap;
    }
    .mh-page-shell__title-block { display: flex; flex-direction: column; gap: 4px; }
    .mh-page-shell__title-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .mh-page-shell__back {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: 1px solid var(--p-content-border-color);
      background: var(--p-content-background);
      color: var(--p-text-color);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 120ms ease, border-color 120ms ease;
      &:hover {
        background: color-mix(in srgb, var(--p-text-color) 6%, transparent);
        border-color: var(--p-primary-300);
      }
      i { font-size: 14px; }
    }
    .mh-page-shell__breadcrumb {
      display: flex;
      gap: 6px;
      font-size: 12px;
      color: var(--p-text-muted-color);
      align-items: center;
    }
    .mh-page-shell__crumb-sep { opacity: 0.5; }
    .mh-page-shell__crumb-link {
      color: var(--p-text-muted-color);
      text-decoration: none;
      transition: color 120ms ease;
      &:hover {
        color: var(--p-primary-500);
        text-decoration: underline;
      }
    }
    .mh-page-shell__breadcrumb .is-current {
      color: var(--p-text-color);
      font-weight: 600;
    }
    .mh-page-shell__title {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      color: var(--p-text-color);
    }
    .mh-page-shell__actions {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .mh-page-shell__body { display: contents; }
  `,
})
export class PageShell {
  private readonly _location = inject(Location);

  @Input({ required: true }) title!: string;
  @Input() breadcrumb?: CrumbInput[];
  @Input() showBack = false;

  /**
   * Normalize both string and object crumb forms to `BreadcrumbItem`.
   * Done in a getter so the template can iterate uniformly.
   */
  protected normalizedCrumbs(): BreadcrumbItem[] {
    return (this.breadcrumb ?? []).map((c) =>
      typeof c === 'string' ? { label: c } : c,
    );
  }

  protected back(): void {
    this._location.back();
  }
}
