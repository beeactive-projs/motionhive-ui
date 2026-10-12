import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SiteHeader } from '../../_shared/components/site-header/site-header';

/**
 * Shell for standalone pages outside the app's sidenav (the error pages): the
 * marketing site's header over a faint honeycomb, with the page centred.
 */
@Component({
  selector: 'mh-guest-layout',
  imports: [RouterOutlet, SiteHeader],
  templateUrl: './guest-layout.html',
  styleUrl: './guest-layout.scss',
})
export class GuestLayout {}
