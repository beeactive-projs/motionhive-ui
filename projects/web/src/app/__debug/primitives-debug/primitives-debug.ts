import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  signal,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import {
  BottomSheet,
  DaySeparator,
  MobileFab,
  StickyCta,
  TimeRow,
} from 'core';

/**
 * `mh-primitives-debug` — dev-only kitchen-sink view for the 5 mobile
 * primitives. Mounted at /__primitives (no auth guard) so we can
 * screenshot each in isolation at multiple viewports before wiring
 * them into real surfaces.
 *
 * Not exported from the route shipped to users — only the dev routes
 * file references it.
 */
@Component({
  selector: 'mh-primitives-debug',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    BottomSheet,
    TimeRow,
    DaySeparator,
    StickyCta,
    MobileFab,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <h1>Primitives</h1>

      <!-- TimeRow ─────────────────────────────────────────────────── -->
      <section class="block">
        <h2>TimeRow</h2>

        <p class="caption">honey tone, default state</p>
        <mh-time-row
          time="09:00"
          duration="60min"
          title="Morning yoga flow"
          tone="honey"
        >
          <span meta>
            <span class="chip chip-green">Confirmed</span>
            <span class="chip-text">8/12 · Herăstrău</span>
          </span>
        </mh-time-row>

        <p class="caption">teal tone (online) + 2-line clamp</p>
        <mh-time-row
          time="11:30"
          duration="60min"
          title="Maria · Strength fundamentals — a long title that should wrap to exactly two lines and then ellipsis"
          tone="teal"
        >
          <span meta>
            <span class="chip chip-blue">1-on-1</span>
            <span class="chip-text">Atlas Gym · Sala 2</span>
          </span>
        </mh-time-row>

        <p class="caption">coral tone + conflict ring</p>
        <mh-time-row
          time="17:00"
          duration="90min"
          title="Powerlifting prep"
          tone="coral"
          [conflict]="true"
        >
          <span meta>
            <span class="chip chip-coral">Conflict</span>
            <span class="chip-text">overlaps Anca · 17:00</span>
          </span>
        </mh-time-row>

        <p class="caption">trailing button (Check in) — chevron OFF</p>
        <mh-time-row
          time="09:00"
          duration="60min"
          title="Morning yoga flow"
          tone="honey"
          [chevron]="false"
        >
          <span meta>
            <span class="chip-text">8/12 · Herăstrău</span>
          </span>
          <p-button
            trailing
            label="Check in"
            size="small"
          />
        </mh-time-row>

        <p class="caption">non-interactive (muted past)</p>
        <mh-time-row
          time="07:30"
          duration="30min"
          title="HIIT 30 (last week)"
          tone="muted"
          [interactive]="false"
          [chevron]="false"
        >
          <span meta>
            <span class="chip-text">Attended · 11/20</span>
          </span>
        </mh-time-row>
      </section>

      <!-- DaySeparator ────────────────────────────────────────────── -->
      <section class="block">
        <h2>DaySeparator</h2>
        <mh-day-separator
          label="Today · Thu 21 May"
          [count]="4"
          note="in 18 min"
          tone="today"
          [sticky]="false"
        />
        <mh-day-separator
          label="Fri 22 May"
          [count]="5"
          [sticky]="false"
        />
        <mh-day-separator
          label="Sat 23 May"
          [count]="1"
          note="1 conflict"
          tone="conflict"
          [sticky]="false"
        />
      </section>

      <!-- BottomSheet triggers ────────────────────────────────────── -->
      <section class="block">
        <h2>BottomSheet</h2>
        <div class="btn-row">
          <p-button
            label="Open filter sheet (large, with foot)"
            (onClick)="filterSheet.set(true)"
          />
          <p-button
            label="Open action sheet (small, no title)"
            severity="secondary"
            [outlined]="true"
            (onClick)="actionSheet.set(true)"
          />
        </div>
      </section>

      <!-- StickyCta + FAB stay always visible. -->
      <section class="block" style="height: 220px;">
        <h2>Sticky elements (scroll the page to test FAB)</h2>
        <p class="caption">
          The FAB hides on scroll-down and reappears on scroll-up at mobile widths.
          The StickyCta below stays fixed.
        </p>
      </section>

      <!-- Filler so FAB has somewhere to scroll. -->
      <div class="filler">filler · scroll me to test FAB hide-on-scroll</div>
    </div>

    <!-- BottomSheet · filter (large) -->
    <mh-bottom-sheet
      [open]="filterSheet()"
      (openChange)="filterSheet.set($event)"
      size="large"
      title="Filters"
      subtitle="Type · Location · Status"
    >
      <p-button
        head-actions
        label="Reset"
        severity="secondary"
        [text]="true"
        size="small"
      />
      <div class="filter-body">
        <p class="label">Type</p>
        <div class="pill-row">
          <span class="pill pill-active">Group</span>
          <span class="pill">1-on-1</span>
          <span class="pill pill-active">Open</span>
        </div>
        <p class="label">Location</p>
        <div class="pill-row">
          <span class="pill">Online</span>
          <span class="pill">In-person</span>
        </div>
        <p class="label">Status</p>
        <div class="pill-row">
          <span class="pill">Scheduled</span>
          <span class="pill">Approval needed</span>
          <span class="pill">Conflict</span>
        </div>
      </div>
      <ng-container foot>
        <p-button
          label="Cancel"
          severity="secondary"
          [outlined]="true"
          (onClick)="filterSheet.set(false)"
        />
        <p-button
          label="Apply · 2 filters"
          (onClick)="filterSheet.set(false)"
          styleClass="primary-flex"
        />
      </ng-container>
    </mh-bottom-sheet>

    <!-- BottomSheet · action (small, no title) -->
    <mh-bottom-sheet
      [open]="actionSheet()"
      (openChange)="actionSheet.set($event)"
      size="small"
      [showClose]="false"
    >
      <ul class="action-list">
        <li><button type="button"><i class="pi pi-external-link"></i> Open session</button></li>
        <li><button type="button"><i class="pi pi-check-circle"></i> Check in attendees</button></li>
        <li><button type="button"><i class="pi pi-send"></i> Message all signups</button></li>
        <li><button type="button"><i class="pi pi-copy"></i> Duplicate</button></li>
        <li><button type="button"><i class="pi pi-share-alt"></i> Share public link</button></li>
        <li><button type="button" class="action-list__danger"><i class="pi pi-times"></i> Cancel session…</button></li>
      </ul>
    </mh-bottom-sheet>

    <!-- Sticky CTA (always visible at mobile; mobile-only by default) -->
    <mh-sticky-cta>
      <div meta>
        <strong>50 RON</strong>
        <span>Invoiced manually</span>
      </div>
      <p-button
        label="Book my spot"
        icon="pi pi-check"
      />
    </mh-sticky-cta>

    <!-- Mobile FAB -->
    <mh-mobile-fab icon="pi pi-plus" (tap)="onCreateTap()" />
  `,
  styles: `
    :host { display: block; }
    .page {
      max-width: 720px;
      margin: 0 auto;
      padding: 24px 16px 120px;
      font-family: 'Inter', system-ui, sans-serif;
    }
    h1 { margin: 0 0 16px; font-size: 24px; font-weight: 700; }
    h2 { margin: 0 0 8px; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--p-text-muted-color); }
    .block { margin-bottom: 32px; display: flex; flex-direction: column; gap: 8px; }
    .caption { margin: 8px 0 4px; font-size: 11px; color: var(--p-text-muted-color); }
    .btn-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .filler { padding: 200px 16px; background: var(--p-surface-50); text-align: center; color: var(--p-text-muted-color); border-radius: 12px; }
    .chip { display: inline-flex; padding: 2px 7px; border-radius: 999px; font-size: 10px; font-weight: 600; }
    .chip-green { background: #DCFCE7; color: #15803D; }
    .chip-blue { background: #DBEAFE; color: #1D4ED8; }
    .chip-coral { background: #FFE4DC; color: #B91C1C; }
    .chip-text { font-size: 10px; color: var(--p-text-muted-color); }
    .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--p-text-muted-color); margin: 0 0 8px; }
    .pill-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
    .pill { padding: 4px 9px; border-radius: 999px; font-size: 11px; font-weight: 600; background: var(--p-content-background); border: 1px solid var(--p-content-border-color); color: var(--p-text-color); }
    .pill-active { background: var(--p-text-color); color: var(--p-content-background); border-color: var(--p-text-color); }
    .action-list { list-style: none; padding: 0; margin: 0; }
    .action-list li { border-bottom: 1px solid var(--p-content-border-color); }
    .action-list li:last-child { border-bottom: none; }
    .action-list button {
      display: flex; align-items: center; gap: 12px;
      width: 100%; padding: 12px 16px; background: transparent;
      border: none; text-align: left; font-size: 13px;
      color: var(--p-text-color); cursor: pointer; font-family: inherit;
    }
    .action-list button i { font-size: 14px; color: var(--p-primary-700); }
    .action-list__danger { color: var(--p-red-700) !important; }
    .action-list__danger i { color: var(--p-red-500) !important; }
    .filter-body p.label:not(:first-of-type) { margin-top: 8px; }
    ::ng-deep .primary-flex { flex: 1; }
  `,
})
export class PrimitivesDebug {
  readonly filterSheet = signal(false);
  readonly actionSheet = signal(false);

  protected onCreateTap(): void {
    console.log('[primitives-debug] FAB tapped');
  }
}
