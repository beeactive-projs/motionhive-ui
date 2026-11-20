import { describe, expect, it, vi } from 'vitest';

import { dismissKeyboard } from './keyboard';

function setup() {
  const field = document.createElement('textarea');
  document.body.append(field);
  field.focus();
  const blur = vi.spyOn(field, 'blur');
  const keyboard = { hide: vi.fn(() => Promise.resolve()) };
  return { field, blur, keyboard };
}

describe('dismissKeyboard', () => {
  // TestFlight build 63 froze and was killed by iOS: a blur() from the page
  // while the keyboard was updating its autocorrect suggestion deadlocked
  // UIKit's keyboard queue. On iOS the native side closes it alone.
  it('never blurs the field itself on iOS, only asks the native keyboard', async () => {
    const { field, blur, keyboard } = setup();

    await dismissKeyboard(field, 'ios', keyboard);

    expect(blur).not.toHaveBeenCalled();
    expect(keyboard.hide).toHaveBeenCalledTimes(1);
    field.remove();
  });

  it('blurs the field and hides the keyboard on Android', async () => {
    const { field, blur, keyboard } = setup();

    await dismissKeyboard(field, 'android', keyboard);

    expect(blur).toHaveBeenCalledTimes(1);
    expect(keyboard.hide).toHaveBeenCalledTimes(1);
    field.remove();
  });

  it('blurs on the web, where there is no Keyboard plugin to answer', async () => {
    const { field, blur } = setup();
    const keyboard = { hide: vi.fn(() => Promise.reject(new Error('not implemented'))) };

    await expect(dismissKeyboard(field, 'web', keyboard)).resolves.toBeUndefined();

    expect(blur).toHaveBeenCalledTimes(1);
    expect(document.activeElement).not.toBe(field);
    field.remove();
  });

  it('does not throw when the native keyboard refuses on iOS', async () => {
    const keyboard = { hide: vi.fn(() => Promise.reject(new Error('gone'))) };

    await expect(dismissKeyboard(null, 'ios', keyboard)).resolves.toBeUndefined();
  });
});
