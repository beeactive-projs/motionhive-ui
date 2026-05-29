import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  input,
} from '@angular/core';

/**
 * `mh-sticky-cta` — fixed-bottom action bar for mobile detail pages.
 *
 * Shape (from design rule D):
 *   ┌────────────────────────────────────────┐
 *   │ [50 RON]  [── Big primary verb ──]     │
 *   │ small meta                              │
 *   └────────────────────────────────────────┘
 *
 * Slots:
 *   - `[meta]`    — small left-side text (price, "Live in 4 min", etc.)
 *   - default     — primary verb button (Book / Join / Re-book / Cancel)
 *   - `[leading]` — optional small left-side button (e.g. bell for waitlist alerts)
 *
 * Mobile-only by default — desktop bar would compete with the page's
 * own action area. Caller controls visibility via `*ngIf` or CSS
 * media query in the host page.
 *
 * Adds bottom padding via `env(safe-area-inset-bottom)` so the bar
 * doesn't collide with the home indicator on iOS.
 */
@Component({
  selector: 'mh-sticky-cta',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mh-sc">
      <div class="mh-sc__meta">
        <ng-content select="[meta]"></ng-content>
      </div>
      <div class="mh-sc__leading">
        <ng-content select="[leading]"></ng-content>
      </div>
      <div class="mh-sc__cta">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 50;
    }
    /* Mobile-only by default. Pass [force]="true" to show on desktop. */
    @media (min-width: 601px) {
      :host:not(.mh-sc-host--force) { display: none; }
    }
    .mh-sc {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      padding-bottom: calc(10px + env(safe-area-inset-bottom, 0));
      background: var(--p-content-background);
      border-top: 1px solid var(--p-content-border-color);
      box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);
    }
    .mh-sc__meta {
      display: flex;
      flex-direction: column;
      font-size: 11px;
      color: var(--p-text-muted-color);
      line-height: 1.2;
      flex-shrink: 0;
      max-width: 40%;
    }
    .mh-sc__meta:empty { display: none; }
    /* Force projected meta content to stack vertically regardless of
       whether the caller wraps it in a div / uses bare strong+span.
       Bigger strong above (the headline number/label), small span
       below. */
    .mh-sc__meta ::ng-deep > * { display: contents; }
    .mh-sc__meta ::ng-deep strong {
      display: block;
      font-size: 13px;
      font-weight: 700;
      color: var(--p-text-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .mh-sc__meta ::ng-deep span {
      display: block;
      font-size: 10px;
      color: var(--p-text-muted-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .mh-sc__leading {
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
    }
    .mh-sc__leading:empty { display: none; }
    .mh-sc__cta {
      flex: 1;
      display: flex;
    }
    /* PrimeNG buttons take full width of the cta slot. */
    .mh-sc__cta ::ng-deep .p-button {
      width: 100%;
      justify-content: center;
      padding: 11px;
    }
  `,
})
export class StickyCta {
  /** Show on desktop too. Default false (mobile-only). */
  readonly force = input(false);

  @HostBinding('class.mh-sc-host--force')
  get _forceClass(): boolean { return this.force(); }
}
