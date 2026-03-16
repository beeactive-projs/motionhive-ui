import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { FeedbackService } from 'core';

@Component({
  selector: 'bee-public-footer',
  imports: [RouterLink, Button],
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
    { icon: 'pi-facebook', href: 'https://facebook.com', label: 'Facebook' },
    { icon: 'pi-twitter', href: 'https://twitter.com', label: 'X (Twitter)' },
    { icon: 'pi-instagram', href: 'https://instagram.com', label: 'Instagram' },
    { icon: 'pi-linkedin', href: 'https://linkedin.com', label: 'LinkedIn' },
  ];

  readonly productLinks = [
    { label: 'Home', path: '/' },
    { label: 'About Us', path: '/about' },
    { label: 'Blog', path: '/blog' },
  ];

  readonly supportLinks = [
    // { label: 'Help Center', path: '#' },
    // { label: 'FAQ', path: '#' },
    { label: 'Terms of Service', path: '/legal/terms-of-service' },
    { label: 'Privacy Policy', path: '/legal/privacy-policy' },
  ];
}
