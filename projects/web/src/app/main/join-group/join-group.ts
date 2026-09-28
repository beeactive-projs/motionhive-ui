import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ButtonDirective } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { GroupService, AuthStore } from 'core';

@Component({
  selector: 'mh-join-group',
  imports: [ProgressSpinnerModule, ButtonDirective, CardModule, TranslatePipe],
  template: `
    <div class="flex items-center justify-center min-h-screen">
      <p-card class="w-full max-w-md">
        @if (loading()) {
          <div class="flex flex-col items-center gap-4 p-8">
            <p-progress-spinner [ariaLabel]="'groups.joinLink.joiningA11y' | translate" />
            <p class="text-lg">{{ 'groups.joinLink.joining' | translate }}</p>
          </div>
        } @else if (error()) {
          <div class="flex flex-col items-center gap-4 p-8 text-center">
            <i class="pi pi-times-circle text-5xl text-red-500" aria-hidden="true"></i>
            <h2 class="text-xl font-semibold">{{ 'groups.joinLink.errorTitle' | translate }}</h2>
            <p class="text-surface-500">{{ error() }}</p>
            <button pButton type="button" (click)="goToDashboard()">
              {{ 'groups.joinLink.goToDashboard' | translate }}
            </button>
          </div>
        } @else {
          <div class="flex flex-col items-center gap-4 p-8 text-center">
            <i class="pi pi-check-circle text-5xl text-green-500" aria-hidden="true"></i>
            <h2 class="text-xl font-semibold">{{ 'groups.joinLink.successTitle' | translate }}</h2>
            <p class="text-surface-500">{{ 'groups.joinLink.successMessage' | translate }}</p>
            <button pButton type="button" (click)="goToDashboard()">
              {{ 'groups.joinLink.goToDashboard' | translate }}
            </button>
          </div>
        }
      </p-card>
    </div>
  `,
})
export class JoinGroup implements OnInit {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _groupService = inject(GroupService);
  private readonly _authStore = inject(AuthStore);
  private readonly _translateService = inject(TranslateService);

  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    const token = this._route.snapshot.paramMap.get('token');
    if (!token) {
      this.loading.set(false);
      this.error.set(this._translateService.instant('groups.joinLink.missingToken'));
      return;
    }

    this._groupService.joinViaLink(token).subscribe({
      next: () => {
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        const message =
          err.error?.message || this._translateService.instant('groups.joinLink.invalidOrExpired');
        this.error.set(message);
      },
    });
  }

  goToDashboard(): void {
    if (this._authStore.isUser()) {
      this._router.navigate(['/user/dashboard']);
    } else {
      this._router.navigate(['/dashboard']);
    }
  }
}
