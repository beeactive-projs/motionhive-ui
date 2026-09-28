import { SelectItem } from 'primeng/api';

import { languageName } from '../../i18n/language-name';
import { translate } from '../../i18n/translator';

export const BlogCategories = {
  Guide: 'Guide',
  Nutrition: 'Nutrition',
  Science: 'Science',
  Wellness: 'Wellness',
} as const;

export type BlogCategory = (typeof BlogCategories)[keyof typeof BlogCategories];

/**
 * A post's category in the UI language (`enum.blogCategory`). The built-in
 * categories are copy; any other one a writer typed is data, shown as stored.
 */
export function blogCategoryLabel(category: string | null | undefined): string {
  if (!category) return '';
  const key = `enum.blogCategory.${category}`;
  const label = translate(key);
  return label === key ? category : label;
}

/** Labels are getters — this is a module constant, read after translations load. */
export const BLOG_CATEGORY_OPTIONS: SelectItem<BlogCategory>[] = Object.values(BlogCategories).map(
  (value) => ({
    value,
    get label() {
      return blogCategoryLabel(value);
    },
  }),
);

export const BlogLanguages = {
  English: 'en',
  Romanian: 'ro',
} as const;

export type BlogLanguage = (typeof BlogLanguages)[keyof typeof BlogLanguages];

/** The language a post is written in, named in its own language ("Română"). */
export const BLOG_LANGUAGE_OPTIONS: SelectItem<BlogLanguage>[] = Object.values(BlogLanguages).map(
  (value) => ({
    value,
    get label() {
      return languageName(value);
    },
  }),
);
