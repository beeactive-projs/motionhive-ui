import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { FeedbackService, Logo } from 'core';

@Component({
  selector: 'mh-public-footer',
  imports: [RouterLink, Button, Logo],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicFooterComponent {
  private readonly _feedbackService = inject(FeedbackService);

  protected openFeedback(): void {
    this._feedbackService.open();
  }

  readonly currentYear = new Date().getFullYear();

  readonly socialLinks = [
    { icon: 'pi-facebook', href: 'https://facebook.com/motionhive.fit', label: 'Facebook' },
    { icon: 'pi-instagram', href: 'https://instagram.com/motionhive.fit', label: 'Instagram' },
    {
      icon: 'pi-linkedin',
      href: 'https://www.linkedin.com/company/motionhivefit',
      label: 'LinkedIn',
    },
  ];

  readonly productLinks = [
    { label: $localize`Home`, path: '/' },
    { label: $localize`About`, path: '/about' },
    { label: $localize`Blog`, path: '/blog' },
  ];

  readonly supportLinks = [
    { label: $localize`Terms of Service`, path: '/legal/terms-of-service' },
    { label: $localize`Privacy Policy`, path: '/legal/privacy-policy' },
  ];
}
