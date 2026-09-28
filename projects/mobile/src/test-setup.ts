// Relative, not 'core': setup files bypass the tsconfig path mapping. The
// translator lives on a global registry, so the `core` build the specs import
// still sees this registration.
import sharedEn from '../../core/src/i18n/en.json';
import { createMessageFormatTranslator } from '../../core/src/lib/i18n/message-format-translator';
import { registerTranslator } from '../../core/src/lib/i18n/translator';
import appEn from '../public/i18n/en.json';

// Config labels and core's formatting utils translate through `translate()`;
// give specs the real English copy so they assert what a user reads.
registerTranslator(createMessageFormatTranslator({ ...sharedEn, ...appEn }));

// jsdom does not implement matchMedia, which ThemeService relies on.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
