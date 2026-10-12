import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Hex } from 'core';
import { SiteHeader } from '../../_shared/components/site-header/site-header';
import { AuthHero } from './auth-hero.model';

/**
 * Shell for the guest pages under /auth, styled after the marketing site so
 * the hop from "Create your free account" lands somewhere familiar: the site's
 * header (logo, language, theme), its hero column with the page's tagline
 * (wide screens), and the page itself in a site card. As the routes' common
 * parent it stays mounted between pages; only the card's content changes.
 */
@Component({
  selector: 'mh-auth-layout',
  imports: [RouterOutlet, TranslatePipe, Hex, SiteHeader],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.scss',
})
export class AuthLayout {
  private readonly _activatedRoute = inject(ActivatedRoute);

  /** The site hero's guarantees, word for word. */
  protected readonly guarantees = [
    'auth.layout.guarantees.unlimitedClients',
    'auth.layout.guarantees.noSubscription',
    'auth.layout.guarantees.noCard',
  ];
  protected readonly hero = signal<AuthHero | null>(null);

  protected onActivate(): void {
    this.hero.set(this._activatedRoute.firstChild?.snapshot.data['hero'] ?? null);
  }
}
