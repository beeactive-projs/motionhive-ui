import MessageFormat from '@messageformat/core';

import { TranslateFn, TranslateParams } from './translator';

type MessageFunction = (params?: TranslateParams) => string;

/**
 * A `TranslateFn` over a plain translation object, compiled with the same ICU
 * MessageFormat engine the apps run — for unit specs, which have no
 * `TranslateService` but should still render real copy:
 *
 *   registerTranslator(createMessageFormatTranslator({ ...sharedEn, ...appEn }));
 *
 * A missing key comes back as itself, as it does in the apps.
 */
export function createMessageFormatTranslator(messages: object, locale = 'en'): TranslateFn {
  const messageFormat = new MessageFormat(locale);
  const compiled = new Map<string, MessageFunction>();

  return (key, params) => {
    let fn = compiled.get(key);
    if (!fn) {
      const raw = key
        .split('.')
        .reduce<unknown>(
          (node, part) =>
            node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
          messages,
        );
      if (typeof raw !== 'string') return key;
      fn = messageFormat.compile(raw) as MessageFunction;
      compiled.set(key, fn);
    }
    return fn(params);
  };
}
