import { Config } from '@ionic/angular/standalone';

/**
 * Whether the stack's swipe back is on by the app's setting: Ionic's own
 * default, `swipeBackEnabled`, on in iOS mode and off in md.
 *
 * A page that turns it off while it is on screen (`IonRouterOutlet.swipeGesture
 * = false`) sets it back to this on leaving: the outlet has no getter to save
 * the value first. The logger does, because its set rows swipe right to Copy,
 * and Ionic's back gesture (a drag from the left edge, which outranks
 * `ion-item-sliding`) would pop the page instead of copying the set.
 */
export function swipeBackDefault(config: Pick<Config, 'get' | 'getBoolean'>): boolean {
  return config.getBoolean('swipeBackEnabled', config.get('mode') === 'ios');
}

/**
 * A page's hold on Android's back (the button, or the system's swipe in from
 * an edge, which no `swipeGesture` setting touches): above the page stack's
 * own pop (0) and under an open sheet's (100), so a sheet still closes first.
 */
export const PAGE_BACK_PRIORITY = 10;
