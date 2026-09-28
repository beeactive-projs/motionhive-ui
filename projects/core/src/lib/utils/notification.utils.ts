import { translate } from '../i18n/translator';
import { CategoryPreferenceView } from '../models/notification/preference.model';

/**
 * Swaps the BE's English `label` / `description` on a settings row for the
 * UI-language copy (`enum.notificationCategory` / `enum.notificationCategoryHint`).
 * A category this build has no key for keeps the BE text.
 */
export function localizeCategoryPreference(row: CategoryPreferenceView): CategoryPreferenceView {
  return {
    ...row,
    label: translatedOr(`enum.notificationCategory.${row.category}`, row.label),
    description: translatedOr(`enum.notificationCategoryHint.${row.category}`, row.description),
  };
}

function translatedOr(key: string, fallback: string): string {
  const text = translate(key);
  return text === key ? fallback : text;
}
