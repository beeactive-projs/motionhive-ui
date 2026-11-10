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
