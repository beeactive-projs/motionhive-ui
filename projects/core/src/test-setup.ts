import en from './i18n/en.json';
import { createMessageFormatTranslator } from './lib/i18n/message-format-translator';
import { registerTranslator } from './lib/i18n/translator';

// Plain-function utils translate through `translate()`; give specs the real
// English copy so they assert what a user reads, not translation keys.
registerTranslator(createMessageFormatTranslator(en));
