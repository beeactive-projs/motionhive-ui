import {
  Directive,
  ElementRef,
  Renderer2,
  inject,
  input,
  effect,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Directive({
  selector: 'iframe[mhStripeIframe]',
  standalone: true,
})
export class StripeIframeDirective {
  readonly url = input.required<string | null>({ alias: 'mhStripeIframe' });

  private readonly el = inject<ElementRef<HTMLIFrameElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly sanitizer = inject(DomSanitizer);

  constructor() {
    effect(() => {
      const raw = this.url();
      if (!raw) {
        this.renderer.removeAttribute(this.el.nativeElement, 'src');
        return;
      }
      if (!this.isTrustedStripeHost(raw)) {
        this.renderer.removeAttribute(this.el.nativeElement, 'src');
        return;
      }
      const safe: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(raw);
      this.renderer.setProperty(this.el.nativeElement, 'src', safe);
      this.renderer.setAttribute(
        this.el.nativeElement,
        'sandbox',
        'allow-scripts allow-forms allow-same-origin allow-popups',
      );
    });
  }

  private isTrustedStripeHost(raw: string): boolean {
    try {
      const u = new URL(raw);
      return (
        u.protocol === 'https:' &&
        (u.hostname.endsWith('.stripe.com') || u.hostname === 'stripe.com')
      );
    } catch {
      return false;
    }
  }
}
