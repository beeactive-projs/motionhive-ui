import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { GroupService, AuthStore } from 'core';

@Component({
  selector: 'bee-join-group',
  imports: [ProgressSpinnerModule, ButtonModule, CardModule],
  template: `
    <div class="flex items-center justify-center min-h-screen">
      <p-card class="w-full max-w-md">
        @if (loading()) {
          <div class="flex flex-col items-center gap-4 p-8">
            <p-progressSpinner ariaLabel="Joining group" />
            <p class="text-lg">Joining group...</p>
          </div>
        } @else if (error()) {
          <div class="flex flex-col items-center gap-4 p-8 text-center">
            <i class="pi pi-times-circle text-5xl text-red-500" aria-hidden="true"></i>
            <h2 class="text-xl font-semibold">Unable to Join</h2>
            <p class="text-surface-500">{{ error() }}</p>
            <p-button label="Go to Dashboard" (onClick)="goToDashboard()" />
          </div>
        } @else {
          <div class="flex flex-col items-center gap-4 p-8 text-center">
            <i class="pi pi-check-circle text-5xl text-green-500" aria-hidden="true"></i>
            <h2 class="text-xl font-semibold">You're In!</h2>
            <p class="text-surface-500">You have successfully joined the group.</p>
            <p-button label="Go to Dashboard" (onClick)="goToDashboard()" />
          </div>
        }
      </p-card>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JoinGroup implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _groupService = inject(GroupService);
  private readonly _authStore = inject(AuthStore);

  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    const token = this._route.snapshot.paramMap.get('token');
    if (!token) {
      this.loading.set(false);
      this.error.set('Invalid join link. No token provided.');
      return;
    }

    this._groupService.joinViaLink(token).subscribe({
      next: () => {
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        const message = err.error?.message || 'This join link is invalid or has expired.';
        this.error.set(message);
      },
    });
  }

  goToDashboard(): void {
    if (this._authStore.isUser()) {
      this._router.navigate(['/app/client/dashboard']);
    } else {
      this._router.navigate(['/app/dashboard']);
    }
  }
}
