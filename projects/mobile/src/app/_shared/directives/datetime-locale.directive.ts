import { Directive, ElementRef, Renderer2, inject } from '@angular/core';
import { IonDatetime } from '@ionic/angular/standalone';
import { appLocale, translate } from 'core';

/**
 * Puts an `ion-datetime` in the app's language.
 *
 * Left alone, Ionic names months and weekdays in the phone's language, writes
 * Cancel, Done and Time in English whatever the language, and starts the week
 * on Sunday. This gives every picker the app's locale (en-GB or ro-RO, so 24
 * hour time like the rest of the app), our words for those three, and Monday
 * first, the week the app counts everywhere else (ISO, as recurrence does).
 *
 * The selector is the bare element, so a component only has to import this.
 * Set once: a language change reloads the app (see `appLanguage`), and a
 * template binding these inputs itself would win, so templates leave them out.
 */
@Directive({ selector: 'ion-datetime' })
export class DatetimeLocaleDirective {
  constructor() {
    const datetime = inject(IonDatetime, { self: true });
    datetime.locale = appLocale();
    datetime.firstDayOfWeek = 1;
    datetime.cancelText = translate('button.cancel');
    datetime.doneText = translate('button.done');

    // The "Time" row's label is a slot, not an input.
    const renderer = inject(Renderer2);
    const label: HTMLElement = renderer.createElement('span');
    renderer.setAttribute(label, 'slot', 'time-label');
    renderer.appendChild(label, renderer.createText(translate('form.label.time')));
    renderer.appendChild(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement, label);
  }
}
