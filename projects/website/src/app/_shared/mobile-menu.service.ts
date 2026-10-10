import { Service, signal } from '@angular/core';

/**
 * Open state of the mobile menu drawer. The header owns opening and closing;
 * other surfaces (the homepage sticky CTA) read it to step aside.
 */
@Service()
export class MobileMenuService {
  readonly isOpen = signal(false);
}
