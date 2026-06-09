import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import {
  DateWindowsMs,
  SessionInstance,
  SessionService,
} from 'core';

/**
 * Approvals inbox — lists instances with `pendingApprovalCount > 0`.
 *
 * **V1 limitation**: the BE does NOT yet have a dedicated
 * `GET /sessions/approvals` endpoint. We approximate by pulling the
 * upcoming instances and filtering client-side. Acceptable while
 * approval-required sessions are an exception; revisit if it becomes
 * the default.
 *
 * **Planned BE follow-up** (~80 LOC):
 *   - `GET /sessions/approvals` returns participants grouped by instance
 *   - Eager-load the user + instance + template so the FE can show a
 *     single page of "approve / decline" rows without N+1 calls
 *
 * Once that ships, this page replaces the local filter with a single
 * API call.
 */
@Component({
  selector: 'mh-instructor-approvals',
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonModule, TagModule],
  templateUrl: './approvals.html',
  styleUrl: './approvals.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstructorApprovals implements OnInit {
  private readonly _svc = inject(SessionService);
  private readonly _router = inject(Router);
  private readonly _location = inject(Location);

  readonly loading = signal(false);
  readonly all = signal<SessionInstance[]>([]);

  readonly rows = computed(() =>
    this.all()
      .filter((i) => i.pendingApprovalCount > 0)
      .sort(
        (a, b) =>
          new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      ),
  );

  ngOnInit(): void {
    this.load();
  }

  protected goBack(): void {
    // Location.back() === history.back(). If we arrived via deep link or a
    // refresh there's no in-app history to pop, so fall back to the list.
    if (this._router.lastSuccessfulNavigation()?.previousNavigation) {
      this._location.back();
    } else {
      void this._router.navigate(['/coaching/sessions']);
    }
  }

  load(): void {
    this.loading.set(true);
    const now = new Date();
    const horizon = new Date(now.getTime() + DateWindowsMs.ApprovalsHorizon);
    this._svc
      .listInstances({
        dateFrom: now.toISOString(),
        dateTo: horizon.toISOString(),
        status: 'SCHEDULED',
        limit: 100,
      })
      .subscribe({
        next: (res) => {
          this.all.set(res.items);
          this.loading.set(false);
        },
        error: () => {
          this.all.set([]);
          this.loading.set(false);
        },
      });
  }
}
