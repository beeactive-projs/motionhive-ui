import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { Logo } from 'core';
import { ThemeToggleComponent } from '../../../_shared/components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'mh-server-error',
  imports: [ButtonModule, ThemeToggleComponent, Logo],
  templateUrl: './server-error.component.html',
  styleUrl: './server-error.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServerErrorComponent {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);

  private readonly _queryParams = toSignal(this._route.queryParams, { initialValue: {} as Params });

  readonly errorCode = computed(() => parseInt(this._queryParams()['code']) || 500);

  readonly errorTitle = computed(() => {
    switch (this.errorCode()) {
      case 500:
        return 'Internal Server Error';
      case 502:
        return 'Bad Gateway';
      case 503:
        return 'Service Unavailable';
      case 504:
        return 'Gateway Timeout';
      default:
        return 'Server Error';
    }
  });

  readonly errorMessage = computed(() => {
    switch (this.errorCode()) {
      case 500:
        return 'Something went wrong on our end. Our team has been notified and is working on it.';
      case 502:
        return 'We are experiencing connectivity issues with our servers. Please try again in a moment.';
      case 503:
        return 'Our service is temporarily unavailable. We are working to restore it as soon as possible.';
      case 504:
        return 'The request took too long to complete. Please check your connection and try again.';
      default:
        return 'Something went wrong on our end. Please try again later.';
    }
  });

  goHome(): void {
    this._router.navigate(['/']);
  }

  retry(): void {
    window.location.reload();
  }

  goBack(): void {
    window.history.back();
  }
}
